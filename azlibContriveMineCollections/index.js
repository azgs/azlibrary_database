#!/usr/bin/env node

const fs = require("fs-extra");
const csv = require('fast-csv');
//import fs from 'fs-extra';
//import csv from 'fast-csv';
const { Readable } = require('stream');
const { finished } = require('stream/promises');
const {Downloader} = require("nodejs-file-downloader");
const axios = require('axios');
const { promisify } = require('util');

const fetchFile = async (url, path) => {
	console.log(`Fetching file from ${url}`);
	console.log(`Saving to ${path}`);

	let attempts = 1; // Number of attempts to fetch the file
	while (attempts <= 5) { // Retry up to 3 times
		try {
			const response = await fetch(url);
		
			if (!response.ok) {
				if (response.status !== 404) {
					throw new Error(`Unexpected response: ${response.statusText}`);
				} else {
					console.log(`File not found at ${url}, skipping download.`);
					//TODO: Determine what to do in this situation
					return
				}
			}
	
			// Create a write stream to the output file
			const writeStream = fs.createWriteStream(path);

			// Convert the web stream body to a Node.js readable stream and pipe it
			// to the write stream
			await finished(Readable.fromWeb(response.body).pipe(writeStream));
			attempts = 5; // Exit loop if download is successful
			console.log(`File downloaded successfully to ${path}`);
		} catch (error) {
			//console.error('Download failed:', error);
			console.error(`Attempt ${attempts}, error fetching file from ${url}:`, error.message);
			//TODO: Determine what to do in this situation
			attempts++;
		}
	}
}

const fetchFile2 = async (url, path, fileName) => {
	console.log(`Fetching file from ${url} into ${path}/${fileName}`);
	const downloader = new Downloader({
		url: url,
		directory: path,  
		fileName: fileName,
		cloneFiles: false,
		maxAttempts: 3,
		shouldStop: (error) => {
			if (error.statusCode && error.statusCode === 404) {
			  return true; 
			}
		  },
	});
	try {
		const {filePath,downloadStatus} = await downloader.download(); 
		console.log(`File downloaded with ${downloadStatus} to ${filePath}`);
		downloadsSuccess.push(url);
	} catch (error) {
		console.log(`Download failed for ${url}`, error.message, error.statusCode, error.statusMessage);
		if (error.statusCode === 404) {
			downloads404.push(url);
		} else {
			downloadsError.push(url);
		}
		throw error
	}
}

const fetchFile3 = async (url, path, fileName) => {
	console.log(`Fetching file from ${url} into ${path}/${fileName}`);

	const writer = fs.createWriteStream(`${path}/${fileName}`);

	const response = await axios({
		method: 'GET',
		url: url,
		responseType: 'stream',
		timeout: 300000, // Set a timeout for the request
		clarifyTimeoutError: true, // Clarify timeout errors
	});

	/*
	if (response.status !== 200) {
		if (response.status === 404) {
			console.log(`File not found at ${url}, skipping download.`);
			downloads404.push(url);
			return;
		} else {
			console.error(`Unexpected response: ${response.statusText}`);
			downloadsError.push(url);
			throw new Error(`Unexpected response: ${response.statusText}`);
		}
	} else {}
	*/

	response.data.pipe(writer);
	await finished(writer);
}

const fetchFile4 = async (url, path, fileName) => {
	console.log(`Fetching file from ${url} into ${path}/${fileName}`);

	const response = await axios({
		method: 'GET',
		url: url,
		responseType: 'arraybuffer', // Use arraybuffer for binary data
		timeout: 300000, // Set a timeout for the request
		clarifyTimeoutError: true, // Clarify timeout errors
	});

	
	if (response.status !== 200) {
		if (response.status === 404) {
			console.log(`File not found at ${url}, skipping download.`);
			downloads404.push(url);
			return;
		} else {
			console.error(`Unexpected response: ${response.statusText}`);
			downloadsError.push(url);
			throw new Error(`Unexpected response: ${response.statusText}`);
		}
	} else {
		downloadsSuccess.push(url);

	}
	
	const fileData = Buffer.from(response.data, 'binary');
	await fs.writeFile(`${path}/${fileName}`, fileData);
}

const fetchFile5 = async (url, path, fileName) => {
	console.log(`Fetching file from ${url} into ${path}/${fileName}`);

	await axios({
		method: 'GET',
		url: url,
		responseType: 'arraybuffer', // Use arraybuffer for binary data
		timeout: 300000, // Set a timeout for the request
		clarifyTimeoutError: true, // Clarify timeout errors
	}).then(async response => {
		const fileData = Buffer.from(response.data, 'binary');
		await fs.writeFile(`${path}/${fileName}`, fileData);
		downloadsSuccess.push(url);
	}).catch(error => {	
		console.log(`Error fetching file from ${url}:`, error.message);
		if (error.response) {
		if (error.response.status === 404) {
			console.log(`File not found at ${url}, skipping download.`);
			downloads404.push(url);
			return;
		} else {
			console.error(`Unexpected response: ${error.response.status}, ${error.response.statusText}`);
			downloadsError.push(url);
			throw new Error(`Unexpected response: ${error.response.statusText}`);
		}
		}
	})
}

const downloadsSuccess = [];
const downloads404 = [];
const downloadsError = [];

const doTheWork = async (args) => {
	const transformStream = csv.parse({ headers: true })
		.transform(data => ({
			tmp_fileURLs: data.resource_url ? data.resource_url.split(",").map(s => s.trim()) : [], //This is used to fetch the files then deleted 
			title: data.title,
			authors: data.contributors ? data.contributors.split(",").map(s => s.trim()) : [], //TODO: need to regenerate csvs with different separator on this field
			collection_group: {
				name: "Arizona Department of Mines and Mineral Resources"
			},
			year: data.pub_date ? data.pub_date.split("-")[0] : null,
			journal: data.bib_citation,
			links: [{
				name: "AZGS Resource",
				url: data.resource_url,
			}],
			keywords: 
				data.keywords_spatial ? 
					data.keywords_spatial.split(",").map(s => {
						return {
							name: s.trim(),
							type: "place"
						}
					}) : [].concat(
						data.keywords_temporal ? data.keywords_temporal.split(",").map(s => {
							return {
								name: s.trim(),
								type: "temporal"
							}
						}) : [],
						data.keywords_theme ? data.keywords_theme.split(",").map(s => {
							return {
								name: s.trim(),
								type: "theme"
							}
						}) : []
					),
			files: data.filename ? data.filename.split(",").map(s => {
				return {
					name: s.trim(),
					type: s.trim().endsWith(".pdf") ? "document" : "image" // Assuming files are either PDFs or jpgs (which is the case with mine data)
				}
			}) : [],
			language: "English",
			license: {
				type:"CC BY-NC-SA 4.0",
				url:"https://creativecommons.org/licenses/by-nc-sa/4.0/"
			},
			mine_data: {
				resource_id: data.resource_id,
				collection: data.collection,
				//TODO: Need to add start_date and end_date to the csv
			}
		}))
		.on('error', error => console.error(error))
		.on('data', async row => {
			console.log(JSON.stringify(row, null, 4))
			csvStream.pause() // Pause the stream to ensure all data is processed before continuing
			console.log("Processing row for resource_id:", row.mine_data.resource_id);
	
			try {
				const dirPath = args[1] + "/" + row.mine_data.resource_id;
				console.log("Creating directory:", dirPath);
				fs.mkdirSync(dirPath)
				console.log("Directory created successfully, fetching files...");
	
				for (const url of row.tmp_fileURLs) {
					const fileName = url.split("/").pop();
					const dirPath = `${args[1]}/${row.mine_data.resource_id}/${fileName.endsWith(".pdf") ? "document" : "image"}`;
					fs.mkdirSync(dirPath, { recursive: true }); // Ensure the directory exists
					//await fetchFile(url, args[1] + "/" + row.mine_data.resource_id + "/" + url.split("/").pop())
					//await fetchFile(url, `${dirPath}/${fileName}`);
					await fetchFile5(url, dirPath, fileName);
				}
				delete row.tmp_fileURLs; // Remove the temporary URLs after fetching files
	
				console.log("Files fetched, writing data to azgs.json...");
				fs.writeFileSync(dirPath + "/azgs.json", JSON.stringify(row, null, 4));
				console.log('Synchronous data written successfully!');
			} catch (err) {
				console.error('Error writing synchronously:', err.message);
			}
			csvStream.resume(); // Resume the stream after processing the row
		})
		/*
		.on('end', rowCount => {
			console.log(`Parsed ${rowCount} rows`)
			console.log("\n********************************************************")
			console.log("Download successes:", downloadsSuccess.length)
			console.log(downloadsSuccess.join(",\n"));
			console.log("\n********************************************************")
			console.log("Download 404s:", downloads404.length)
			console.log(downloads404.join(",\n"));
			console.log("\n********************************************************")
			console.log("Download errors:", downloadsError.length)
			console.log(downloadsError.join(",\n"));
		});
		*/
		
	console.log("/n/n********************************************************")
	console.log("Processing file:", args[0]);
	//console.log("File content preview:", fs.readFileSync(args[0], 'utf-8').slice(0, 100)); // Print first 100 characters
	const csvStream = fs.createReadStream(args[0])
		.pipe(transformStream)
		.on('end', rowCount => {
			console.log(`Parsed ${rowCount} rows`)
			console.log("\n********************************************************")
			console.log("Download successes:", downloadsSuccess.length)
			console.log(downloadsSuccess.join(",\n"));
			console.log("\n********************************************************")
			console.log("Download 404s:", downloads404.length)
			console.log(downloads404.join(",\n"));
			console.log("\n********************************************************")
			console.log("Download errors:", downloadsError.length)
			console.log(downloadsError.join(",\n"));
		});

}

const args = process.argv.slice(2);
console.log("start")
console.log(args)

if (args[0] === "--help") {
	console.log("Usage: azlibContriveMineCollections file1");
	return;
}

if (args.length < 2) {
	console.log("Must provide csv file and destination folder"); 
	return
}

if (!args[0].endsWith(".csv")) {
	console.log("Need one csv file");
	return
}

if (!fs.existsSync(args[0])) {
	console.log("CSV file does not exist");
	return;
}

if (!fs.existsSync(args[1])) {
	console.log("Destination folder does not exist");
	return;
}

doTheWork(args);


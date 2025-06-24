#!/usr/bin/env node

const fs = require("fs-extra");
const csv = require('fast-csv');
//import fs from 'fs-extra';
//import csv from 'fast-csv';
const { Readable } = require('stream');
const { finished } = require('stream/promises');

const fetchFile = async (url, path) => {
	console.log(`Fetching file from ${url}`);
	console.log(`Saving to ${path}`);
	try {
		const response = await fetch(url);
	
		if (!response.ok) {
			if (response.status !== 404) {
				throw new Error(`Unexpected response: ${response.statusText}`);
			} else {
				console.log(`File not found at ${url}, skipping download.`);
				return
			}
		}
  
		// Create a write stream to the output file
		const writeStream = fs.createWriteStream(path);

		// Convert the web stream body to a Node.js readable stream and pipe it
		// to the write stream
		await finished(Readable.fromWeb(response.body).pipe(writeStream));

	  console.log(`File downloaded successfully to ${path}`);
	} catch (error) {
	  //console.error('Download failed:', error);
	  console.error(`Error fetching file from ${url}:`, error.message);
	}
}

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
					await fetchFile(url, args[1] + "/" + row.mine_data.resource_id + "/" + url.split("/").pop())
				}
				delete row.tmp_fileURLs; // Remove the temporary URLs after fetching files
	
				console.log("Files fetched, writing data to azgs.json...");
				fs.writeFileSync(dirPath + "/azgs.json", JSON.stringify(row, null, 4));
				console.log('Synchronous data written successfully!');
			} catch (err) {
				console.error('Error writing synchronously:', err);
			}
			csvStream.resume(); // Resume the stream after processing the row
		})
		.on('end', rowCount => console.log(`Parsed ${rowCount} rows`));
	
	console.log("Processing file:", args[0]);
	console.log("File content preview:", fs.readFileSync(args[0], 'utf-8').slice(0, 100)); // Print first 100 characters
	const csvStream = fs.createReadStream(args[0])
		.pipe(transformStream)
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


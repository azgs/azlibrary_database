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
const { pipeline } = require('stream/promises');

const fetchFile = async (url, path, fileName) => {
	console.log(`Fetching file from ${url} into ${path}/${fileName}`);

	return await axios({
		method: 'GET',
		url: url,
		responseType: 'arraybuffer', // Use arraybuffer for binary data
		timeout: 300000, // Set a timeout for the request
		clarifyTimeoutError: true, // Clarify timeout errors
	}).then(response => {
		console.log(`File downloaded successfully from ${url}`);
		const fileData = Buffer.from(response.data, 'binary');
		fs.writeFileSync(`${path}/${fileName}`, fileData);
		downloadsSuccess.push(url);
		return true; // Indicate success
	}).catch(error => {	
		console.log(`Error fetching file from ${url}:`, error.message);
		if (error.response && error.response.status === 404) {
			console.log(`File not found at ${url}, skipping download.`);
			downloads404.push(url);
		} else {
			console.error(`Unexpected download error:`, error.message);
			downloadsError.push(url);
			//throw new Error(`Unexpected download error:`, error.message);
		}
		return false; // Indicate failure
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
				name: "AZGS old",
				url: data.resource_url.replace("magazine", "minedata"),
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
			language: "English",
			identifiers: {},
			private: false,
			bounding_box: {
				east: "-109.045223",
				west: "-114.81651",
				north: "37.00426",
				south: "31.332177"
			},
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

	console.log("\n\n********************************************************")
	console.log("Processing file:", args[0]);

	try {
		await pipeline(
			fs.createReadStream(args[0]),
			transformStream,
			async (source) => { 
				for await (const row of source) {
					console.log("\n\n**************************************************");
					console.log("Processing row for resource_id:", row.mine_data.resource_id);
					try {
					const dirPath = args[1] + "/" + row.mine_data.resource_id;
					console.log("Creating directory:", dirPath);
					fs.mkdirSync(dirPath)
					console.log("Directory created successfully, fetching files...");
		
					for (const url of row.tmp_fileURLs) {
						console.log("------------");
						console.log("Processing url:", url);
						const fileName = url.split("/").pop();
						const dirPath = `${args[1]}/${row.mine_data.resource_id}/${fileName.endsWith(".pdf") ? "documents" : "images"}`;
						fs.mkdirSync(dirPath, { recursive: true });
						const fileStatus = await fetchFile(url, dirPath, fileName);
						console.log("File status:", fileStatus);
						if (fileStatus) {
							console.log(`File at ${url} downloaded successfully.`);
							if (!row.files) {
								row.files = [];
							}
							row.files.push({
								name: fileName,
								type: fileName.endsWith(".pdf") ? "documents" : "images"
							});
						} else {
							console.log(`Failed to download file at ${url}`);
						}
					}
					delete row.tmp_fileURLs; // Remove the temporary URLs after fetching files
					
					console.log("Files fetched, writing data to azgs.json...");
					fs.writeFileSync(dirPath + "/azgs.json", JSON.stringify(row, null, 4));
					console.log('azgs.json written successfully!');
				} catch (err) {
					console.error('Error creating azgs.json:', err.message);
				}
				}
			}
		);
		console.log(`${args[0]} processed successfully.`);
	} catch (error) {
		console.error('Pipeline failed:', error);
	}
	//console.log(`Parsed ${rowCount} rows`)
	console.log("\n********************************************************")
	console.log("Download successes:", downloadsSuccess.length)
	console.log(downloadsSuccess.join(",\n"));
	console.log("\n********************************************************")
	console.log("Download 404s:", downloads404.length)
	console.log(downloads404.join(",\n"));
	console.log("\n********************************************************")
	console.log("Download errors:", downloadsError.length)
	console.log(downloadsError.join(",\n"));
	
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


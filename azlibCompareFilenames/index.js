#!/usr/bin/env node

const fs = require("fs-extra");

const readFileIntoArraySync = (filePath) => {
	try {
	  	const fileContent = fs.readFileSync(filePath, 'utf-8');
	  	return fileContent.split('\n').map(s => s.trim());
	} catch (error) {
	  	console.error('Error reading file:', error);
	  	return []; // Return an empty array in case of an error
	}
}
  
const readFileIntoObjectSync = (filePath) => {
	try {
	  	const fileContent = fs.readFileSync(filePath, 'utf-8');
	  	const objEntries = fileContent.split('\n').map(filename => {
			return [filename.trim(), true]
		})
		return Object.fromEntries(objEntries);
	} catch (error) {
	  	console.error('Error reading file:', error);
	  	return []; // Return an empty array in case of an error
	}
}



const args = process.argv.slice(2);
console.log("start")
console.log(args)

if (args.length < 2) {
	console.log("Need two files to compare");
	return
}

if (args[0] === "--help") {
	console.log("Usage: azlibCompareFilenames file1 file2");
	return;
}

if (!fs.existsSync(args[0]) || !fs.existsSync(args[1])) {
	console.log("One or both files do not exist");
	return;
}

if (args[0] === args[1]) {
	console.log("Files are the same");
	return;
}
	
const filenamesArray = readFileIntoArraySync(args[1]);
//console.log("filenamesArray")
//console.log(filenamesArray)

const filenamesMap = readFileIntoObjectSync(args[0]);
//console.log("filenamesMap")
//console.log(filenamesMap)

const objectsNotInFile1 = filenamesArray.filter( 
  filename => !filenamesMap[filename] 
);

console.log(`Filenames in ${args[1]} that are not in ${args[0]}:`);
objectsNotInFile1.forEach(filename => {
	  console.log(filename);
});


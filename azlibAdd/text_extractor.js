exports.extract = (file) => {
	console.log("text_extractor.extract: extracting text from " + file);

	const fs = require('fs');
	let dataBuffer = fs.readFileSync(file);

	const suffix = file.split('.')[file.split('.').length-1].toUpperCase();

	console.log("text_extractor.extract: suffix = " + suffix);
	if (suffix === "TXT") {
		return Promise.resolve({text:dataBuffer});	
	} else if (suffix === "PDF") {
		const pdf = require('pdf-parse');
		return pdf(dataBuffer);
	} else if (suffix === "DOC") { 
		const we = require("word-extractor");
		const extractor = new we();
		const extracted = extractor.extract(file);
		return extracted.then(doc => {
			return {text: doc.getBody()};
		});
	} else if (suffix === "DOCX") {
		const mammoth = require("mammoth");
		return mammoth.extractRawText({path: file}).then(result => {
        	return {text: result.value}; 
		});
	} else if (suffix === "RTF") {
		const textract = require("textract");
		const util = require('util');
		const textractPromise = util.promisify(textract.fromFileWithPath);
		return textractPromise(file).then(result => {
			return {text: result};
		})
		.catch(error => {console.log("problem processing " + file); console.log(error); throw new Error(error);});
	} else {
		return Promise.reject("Unrecognized document file type");
	}
}


/*
	As it turns out, democracy 3's pak files are not simple zips.
	But they're fricken archives. I can open it up in notepad++ or any hexeditor and see the payload. 
	So, I'm figuring out the format and making an app to extract the data of mods. In javascript, of all things.
	It's a glorified data mover, relying on a highly specific format, which basically just moves data from one file to lots of little files.
	But literally nobody else is doing it. So here I am.
	
	By leaf.
 */

window.onload = function()
{
	initialize();
}

function initialize()
{
	createUI();
}

var UI = {};
function createUI()
{
	/* File Input */
	UI.fileInputContainer = document.createElement("div");
	document.body.appendChild(UI.fileInputContainer);
	
	UI.fileInput = document.createElement("input");
	UI.fileInput.setAttribute("type", "file");
	UI.fileInputContainer.appendChild(UI.fileInput);
	
	UI.fileInputButton = document.createElement("button");
	UI.fileInputButton.innerHTML = "Upload";
	UI.fileInputButton.onclick = readUploadedFile;
	UI.fileInputContainer.appendChild(UI.fileInputButton);
	
	/* View Generated Files */
	UI.output = document.createElement("div");
	document.body.appendChild(UI.output);
}

function displayOutput(output)
{
	// clear first 
	UI.output.innerHTML = "";
	
	for(var filePath in output)
	{
		var data = output[filePath];
		var fileLink = URL.createObjectURL(data);
		var fileName = filePath.split('/');
		fileName = fileName[fileName.length - 1];
		
		// create UI
		var downloadableFileContainer = document.createElement("div");
		UI.output.appendChild(downloadableFileContainer);
		
		var downloadableFileLink = document.createElement("a");
		downloadableFileLink.innerHTML = filePath;
		downloadableFileLink.setAttribute("href", fileLink);
		downloadableFileLink.setAttribute("download", fileName);
		downloadableFileContainer.appendChild(downloadableFileLink);
	}
	
	console.log(output);
}

function readUploadedFile()
{
	var file = UI.fileInput.files[0];
	if(!file) return;
	readFileAsBinary(file);
}

function readFileAsBinary(file)
{
	var reader = new FileReader();
	reader.onload = function(event)
	{
		var result = event.target.result;
		var decodedOutput = decodePakFile(result);
		displayOutput(decodedOutput);
	}
	reader.onerror = function(event)
	{
		console.log(`Error occured in file reader: `);
		console.log(event);
	}
	reader.readAsArrayBuffer(file);
}

function decodePakFile(arrayBuffer)
{
	/*
		Format: a 32-bit little-endian integer who denotes the length of what follows:
		File Name Count:
			File Name Length:
				File Name 
		File Length
			File
		Ending
	 */
	var pak = new Uint8Array(arrayBuffer);
	var pakIndex = 0;
	
	function getNextByte()
	{
		return pak[pakIndex++];
	}
	
	function getNextNBytes(n)
	{
		if(pakIndex + n > pak.length)
		{
			console.warn(`Out of bounds error: cannot access next ${n} bytes from position ${pakIndex}, array is size ${pak.length}.`);
			return;
		}
		return pak.subarray(pakIndex, pakIndex+=n);
	}
	
	// expected count of file paths which is stored in the first four bytes
	var filePathCount = uint8ArrayToInteger(getNextNBytes(4), true);
	
	// get all the file paths from the thingy
	var filePaths = [];
	for(var count = 0; count < filePathCount; count++)
	{
		var filePathLength = uint8ArrayToInteger(getNextNBytes(4), true);
		
		// data in raw hex form
		var data = getNextNBytes(filePathLength);
		
		// now convert to string 
		var filePath = uint8ArrayToString(data);
		filePaths.push(filePath);
	}
	
	// now we break up the data into chunks, same deal, prefix indicating size and then payload
	var files = {};
	for(var key in filePaths)
	{
		var fileLength = uint8ArrayToInteger(getNextNBytes(4), true);
		var data = getNextNBytes(fileLength);
		// make it into a blob
		files[filePaths[key]] = new Blob([typedArrayToBuffer(data)]);
	}
	
	return files;
}

function uint8ArrayToString(uint8Array) 
{
	// thank god we're in a browser, so we can use textencoder!
	var string = new TextDecoder().decode(uint8Array);
	return string;
}

function uint8ArrayToInteger(uint8Array, littleEndian=false)
{
	// we're actually fed a sub array, whose buffer is ALL going to be the same. so we can't just call on the buffer
	var view = new DataView(typedArrayToBuffer(uint8Array), 0);
	return view.getUint32(0, littleEndian);
}

function typedArrayToBuffer(array)
{
	// because sub arrays can have the same buffers as parent arrays, which leads to all sorts of fun bugs like figuring out why the number returned is always 4
	return array.buffer.slice(array.byteOffset, array.byteLength + array.byteOffset);
}

/* 
	Old Notes; it's all wrong, but rather funny.
	
	File/Payload Format: 
		Automatically generates a four letter word in hex that prefixes each file.
			For txt files, it represents the following length of said file.
			Actually, that applies to all files;
				I think I just detected plagiarism between two mods. So THAT'S what's been screwing me up.
		This is not consistent between .pak files, but is consistent internally within each .pak file.
			eg. 
			80 00 01 00 is prefix for DDS files in one such pak file, but in another, it's D4 55 01 00
		It is possible that such a value has simply changed between game versions, since my examples are all grabbed at random.
		
	Ending Format:
		0D 0A 0D 0A (two carriage returns)
 */
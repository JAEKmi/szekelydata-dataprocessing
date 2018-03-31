var fs = require("fs");
var promise = require("promise");
var geocoder = require('geocoder');
var bp = require('./birthPlaces');
var alreadyDecoded = require('./alreadyDecoded');

geocoder.selectProvider("geonames", { "username": "Tomecke" });

function migration(city1, city2) {
    this.bornwhere = city1;
    this.liveswhere = city2;
}

function city(name, longitude, latitude, geoID){
	this.name = name;
	this.longitude = longitude;
	this.latitude = latitude;
	this.id = geoID;
	this.numOfBirths = 0;
	this.numOfInhabitants = 0;
}

//var array = ["alma", "korte", "sapka"];
//let re1 = new RegExp(array.toString());
//console.log(array.indexOf("sapka"));
//console.log(/sapka/.test(array.toString()));
getGeoSpecs("Cluj Napoca").then(function (data) { console.log(data); })
//console.log(bp.birthPlaces);
//console.log(alreadyDecoded.arr.length);
//getData();

function countBirths(data) {
    var result = [];
    for (var i = 0; i < data.length; ++i)
        if (data[i].birth) {
            var reg = new RegExp(data[i].birth.toLowerCase());
            var gotIT = false;
            for (var j = 0; j < result.length && gotIT == false; ++j)        
                if (reg.test(result[j].cityName)) {
                    result[j].population++;
                    gotIT = true;
                }
            if (gotIT == false)
                result.push({ cityName: data[i].birth.toLowerCase(), population: 0 });
           
        }
    result.forEach(function (elem) {
        if (elem.cityName == "vlahica")
            elem.correctedName = "vlahita";
        if (elem.cityName == "regen")
            elem.correctedName = "reghin";
        if (elem.cityName == "udvarhely")
            elem.correctedName = "Odorheiu Secuiesc";
        if (elem.cityName == "keresztur")
            elem.correctedName = "Cristuru Secuiesc";
        if (elem.cityName == "barot")
            elem.correctedName = "Baraolt";
        if (elem.cityName == "balan")
            elem.correctedName = "balanbanya";
    });

    return result;
}


function getData(){
	var url = "data.json";
	readFile(url).then(function(data){
	    var jsonContent = JSON.parse(data);

	   //geoCode the birthplaces first here 
	  //var birthPlaces = countBirths(jsonContent);
	   function geocodeBirthPlaces(birthArray) {
	        return new promise(function (fulfill, reject) {
	            var decodedArray = [];
	            var awaiting = birthArray.length;
	            birthArray.forEach(function (element) {
	                var nameToSearchFor;

	                if (element.correctedName)
	                    nameToSearchFor = element.correctedName;
	                else
	                    nameToSearchFor = element.cityName;

	                getGeoSpecs(nameToSearchFor).then(function (data) {
	                    data.numOfBirths = element.population;
	                    data.name = element.cityName;
	                    decodedArray.push(data);
	                    --awaiting;
	                    if (awaiting == 0) {  
	                        fulfill(decodedArray);
	                    }
	                }, function (err) { throw err; });
	            });
	        });
	    }
	    //we don't need to geocode the birthplaces multiple times since after the first time I inserted the geocoded data into a module and imported it to my project 
        //so that's why this part of the code is commented out
        /*
	    geocodeBirthPlaces(birthPlaces).then(function (data) {
	        var json = JSON.stringify(data);
	        writeFile("writtenFiles/birth1.json", json).then(function (result) { console.log(result); }, function (err) { throw err; });
	    }, function (err) { throw err; });
        */

	    //geoCode the current residences here
		function geocodeAll(jsonContent) {
		    return new promise(function (fulfill, reject) {
		        var decodedArray = [];
		        var migrationArray = [];
		        //insert every single already decoded element to this array
		        //bp.birthPlaces.forEach(function (elem) { decodedArray.push(elem); });
		        decodedArray = alreadyDecoded.arr;
		        var awaitingCities = 614, index = 43001;

		        function geocodeRecursive(index) {
		            if (!awaitingCities) 
		                fulfill([decodedArray, migrationArray]);        
		            else {   
		                if (jsonContent[index].livesin) {
		                    getGeoSpecs(jsonContent[index].livesin).then(function (data) {
		                        if (data != null) {
		                            var idx = isAlreadyDecoded(data, decodedArray);
		                            if (idx != -1) {
		                                decodedArray[idx].numOfInhabitants++;
		                            }
		                            else {
		                                data.numOfInhabitants++;
		                                decodedArray.push(data);
		                            }
		                            --awaitingCities;
		                            //set up the migration array if there is both birthplace and current residence properties in the current object 
		                            if (jsonContent[index].birth)
		                                var migr = new migration(jsonContent[index].birth, data.name);
		                            migrationArray.push(migr);
		                        }
		                        else
		                            --awaitingCities;
		                        console.log(index);
		                        geocodeRecursive(index + 1);
		                    }, function (err) { reject(err); });
		                }
		            }
		        }
		        geocodeRecursive(index);
		    });
		}
        
		geocodeAll(filterOutEmptyCities(jsonContent)).then(function (data) {
		    //console.log("Number of cities:" + data.length);
		    //console.log(data[1].length);
		    var json1 = JSON.stringify(data[0]);
		    var json2 = JSON.stringify(data[1]);
		    writeFile("writtenFiles/city2.json", json1).then(function (result) { console.log(result); }, function (err) { throw err; });
		    writeFile("writtenFiles/migrations7.json", json2).then(function (result) { console.log(result); }, function (err) { throw err; });
		}, function (err) { throw err; });
        

	}, function(error){
		throw error;
	});
}

function isAlreadyDecoded(city, decodedCities) {
    for (var i = 0; i < decodedCities.length; ++i) {
        if (decodedCities[i].id == city.id)
            return i;
    }
    return -1;
}


function filterOutEmptyCities(jsonContent) {
    var filtered = [];
    jsonContent.forEach(function (obj) {
        if (obj.livesin)
            filtered.push(obj);
    });
    return filtered;
}

function getGeoSpecs(cityName) {
    return new promise(function (fulfill, reject) {
        geocoder.geocode(cityName, function (err, data) {
            if (err) {
                reject(err);
            }
            if (data.totalResultsCount > 0) {
                var geonames = data.geonames[0];
                var resultCity = new city(geonames.name, geonames.lng, geonames.lat, geonames.geonameId);
                fulfill(resultCity);
            }
            else
                fulfill(null);
        });
    });
}

function readFile(url){
	return new promise(function(fulfill, reject){
		fs.readFile(url, 'utf-8',function(error, data){
			if(error)
				reject(error);
			else
				fulfill(data);
		});
	});
}

function writeFile(filename, data) {
    return new promise(function (fulfill, reject) {
        fs.writeFile(filename, data, 'utf8', function (error) {
            if (error)
                reject(error);
            else
                fulfill("Done!");
        });
    });
}
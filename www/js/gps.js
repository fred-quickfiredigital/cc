batteryLevel = 100;
var gpsData = {};
isTracking = true;
gpsLastPosition = {};
gpsAjaxData = {
//    auth: auth
    gps: {}
};
var doSync = false;
var gps = {
    GPSWatchId: null,
    gpsErrorCount: 0,
    gatheringTimer: null,
    sendingTimer: null,
    init: function() {
//        gps.initToggleListener();
        gps.start();
    },
    initToggleListener: function() {
    },
    sync: function() {
        isTracking = false;
        console.log("Sync Started");
		gpsSendingTimeOut(true);
    },
	start: function() {
        isTracking = true;
        $("#start-tracking").hide();
        $("#stop-tracking").show();
        showNotification();
        console.log("Tracking Started");

        var gpsOptions = {
            enableHighAccuracy: app.HIGH_GPS_ACCURACY,
            timeout: 1000 * 60 * 4,
            maximumAge: 1 * 1000,
            frequency: getGpsGatheringTime()
        };
        gps.GPSWatchId = navigator.geolocation.watchPosition(onSuccess, onError, gpsOptions);
//        navigator.geolocation.getCurrentPosition(onSuccess,onError, gpsOptions, {enableHighAccuracy: true});
        var gpsGatheringTime = getGpsGatheringTime();
        gps.gatheringTimer = window.setTimeout(gpsGatheringTimeOut, gpsGatheringTime);
        gps.sendingTimer = window.setTimeout(gpsSendingTimeOut(false), 20 * 1000);
        
    },
    stop: function() {
        isTracking = false;
        $("#stop-tracking").hide();
        $("#start-tracking").show();
        cancelNotification();

        if (gps.sendingTimer) {
            window.clearTimeout(gps.sendingTimer);
        }
        gpsSendingTimeOut(doSync);
        console.log("Tracking Stopped");
        if (gps.GPSWatchId)
        {
            navigator.geolocation.clearWatch(gps.GPSWatchId);
        }
        if (gps.gatheringTimer) {
            window.clearTimeout(gps.gatheringTimer);
        }
        if (gps.sendingTimer) {
            window.clearTimeout(gps.sendingTimer);
        }

    }
};



function gpsGatheringTimeOut() {
    var gpsGatheringTime = getGpsGatheringTime();
    gps.gatheringTimer = window.setTimeout(gpsGatheringTimeOut, gpsGatheringTime);
    gatherGpsdata();
}

function getGpsGatheringTime()
{
    return 10000; 
}

function getGpsSendingtime()
{	
	return 4000; 
}

function uploadAmount() {
	
	if(!pc){
		var networkState = navigator.connection.type;
		var upload = {};
		upload[Connection.UNKNOWN] = 10;
		upload[Connection.ETHERNET] = 30;
		upload[Connection.WIFI] = 30;
		upload[Connection.CELL_2G] = 1;
		upload[Connection.CELL_3G] = 10;
		upload[Connection.CELL_4G] = 30;
		upload[Connection.CELL] = 1;
		upload[Connection.NONE] = 0;
		return upload[networkState];
	} else {
		return 5;
	}
	
	
	
}

function gpsSendingTimeOut(doSync)
{
	var tmpgpsData = permanentStorage.getItem("gpsData");
	var storedAuth = permanentStorage.getItem("auth");
	var gpsAjaxDataToSend = {};
	gpsAjaxDataToSend.gps = {};
	
	if(tmpgpsData === null) {
		console.log("No data stored in local storage");
		return;
	} else {
		var tmpgpsData = JSON.parse(tmpgpsData);
		var keys = Object.keys(tmpgpsData);
		keys = keys.reverse();
		
		var j = uploadAmount();
		if(keys.length < j) {
			j = keys.length;
		}
		
		console.log('Sending Data');
		
		for (i = 0; i < j; i++) {
			var k = keys[i];
			if(k !== 'undefined' && k !== null) {
				if(typeof tmpgpsData[k].auth !== 'undefined') {
					var a = tmpgpsData[k].auth;
				} else if (storedAuth !== null) {
					var a = storedAuth;
				} else {
					app.doLogin();
				}
				if(typeof gpsAjaxDataToSend.gps[a] === 'undefined') {
					gpsAjaxDataToSend.gps[a] = {};
				}
				gpsAjaxDataToSend.gps[a][k] = tmpgpsData[k];
			}
		}
		
		gpsAjaxDataToSend = JSON.stringify(gpsAjaxDataToSend);
		
		$.ajax("http://www.coachclick.co.uk/app/track.php", {
			type: "POST",
			dataType : 'json',
			data: gpsAjaxDataToSend			
		}).done(function(response) {
			// console.log(response.storedgps);
			for (i = 0; i < response.storedgps.length; i++) {
				delete (tmpgpsData[response.storedgps[i]]);
			}
			permanentStorage.setItem("gpsData", JSON.stringify(tmpgpsData));				
		}).always(function(response) {
			checkConnection();
			var toSync = checkUnsent();
			if(!doSync || toSync > 0) {
				gps.sendingTimer = window.setTimeout(function(){ gpsSendingTimeOut(doSync)}, getGpsSendingtime());
				console.log(getGpsSendingtime());
			}
			
			// console.log(tmpgpsData);
		}).fail(function(response) {
			// console.log("always : ",response);
		});
		
	}
}

function onSuccess(position) {
	// console.log(position);
    gpsLastPosition = {};
    gpsLastPosition["auth"] = auth;
    gpsLastPosition["lat"] = position.coords.latitude;
    gpsLastPosition["lng"] = position.coords.longitude;
    gpsLastPosition["alt"] = position.coords.altitude;
    gpsLastPosition["speed"] = position.coords.speed;
    gpsLastPosition["heading"] = position.coords.heading;
    gpsLastPosition["accuracy"] = position.coords.accuracy;
    gpsLastPosition["acc-x"] = position.coords.accuracy;
    gpsLastPosition["acc-y"] = position.coords.accuracy;
    gpsLastPosition["acc-z"] = position.coords.altitudeAccuracy;
    gpsLastPosition["batt"] = batteryLevel;
    gpsLastPosition["gpstimestamp"] = position.timestamp;
    // console.log("WatchPosition got data: " + JSON.stringify(gpsLastPosition));
}

function gatherGpsdata() {	
	var tmpgpsData = permanentStorage.getItem("gpsData");
	if(tmpgpsData !== null) {
		gpsData = JSON.parse(tmpgpsData);
	}
    gpsData[(Math.round(new Date().getTime() / 1000)).toString()] = gpsLastPosition;
    permanentStorage.setItem("gpsData", JSON.stringify(gpsData));
	
	checkConnection();
	checkUnsent();
    console.log('GPS Gathered');
}

function onError(error) {
    alert("Error getting gps data. Please restart emulator.");
    console.log("GPS onError. Please restart emulator.");
    isTracking = false;
    $("#stop-tracking").hide();
    $("#start-tracking").show();
    $("#logout-button").show();
    cancelNotification();
    //        sendDataBeforeStopTracking();
    // Clear old timer.
    if (gps.sendingTimer) {
        window.clearTimeout(gps.sendingTimer);
    }
//    gpsSendingTimeOut();
    console.log("Tracking Stoped");
    if (gps.GPSWatchId)
    {
        navigator.geolocation.clearWatch(gps.GPSWatchId);
    }
    if (gps.gatheringTimer) {
        window.clearTimeout(gps.gatheringTimer);
    }
    // Clear new timer.
    if (gps.sendingTimer) {
        window.clearTimeout(gps.sendingTimer);
    }

//    alert(JSON.stringify(error));
//    navigator.geolocation.clearWatch(gps.GPSWatchId);
}

function onBatteryStatus(info) {
    batteryLevel = info.level;
    console.log("Level: " + info.level + " isPlugged: " + info.isPlugged);
	if(info.isPlugged) {
		$('#batterylevel').text('AC');
	} else {
		$('#batterylevel').text(batteryLevel+'%');
	}
	
	if (gps.sendingTimer) {
        window.clearTimeout(gps.sendingTimer);
    }
    gps.sendingTimer = window.setTimeout(gpsSendingTimeOut(doSync), getGpsSendingtime());
	
}
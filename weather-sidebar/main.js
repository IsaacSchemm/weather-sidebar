"use strict";

class WeatherViewModel {
    constructor() {
        this.settingsModel = ko.observable(null);

        this.twelveHourTime = ko.observable(true);
        this.latitude = ko.observable(null);
        this.longitude = ko.observable(null);
        this.useGeolocation = ko.observable(true);

        this.error = ko.observable(null);
        this.temperature = ko.observable(null);
        this.description = ko.observable(null);

        this.lastLatitude = null;
        this.lastLongitude = null;

        this.hourlyForecast = ko.observableArray();
    }

    async update() {
        this.updateForecast({
            latitude: this.latitude(),
            longitude: this.longitude()
        });

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(l => this.updateForecast(l.coords));
        }
    }

    async updateForecast(coords) {
        try {
            if (coords == null) {
                coords = {
                    latitude: this.latitude(),
                    longitude: this.longitude()
                };
            }

            if (coords.latitude == null || coords.longitude == null) { 
                return;
            }

            if (coords.latitude == this.lastLatitude && coords.longitude == this.lastLongitude) {
                console.log("Same location")
                return;
            }

            this.lastLatitude = coords.latitude;
            this.lastLongitude = coords.longitude;

            let data = await $.getJSON(`proxy.ashx?url=${coords.latitude},${coords.longitude}`);
            
            this.temperature(Math.round(data.currently.temperature) + String.fromCodePoint(0xB0));
            this.description(data.currently.summary);

            this.hourlyForecast([]);
            for (let h of data.hourly.data.slice(0, 18)) {
                let icon = (() => {
                    switch (h.icon) {
                        case "clear-day":
                        case "clear-night":
                            return String.fromCodePoint(9728);
                        case "rain":
                            return String.fromCodePoint(127783);
                        case "snow":
                        case "sleet":
                            return String.fromCodePoint(127784);
                        case "wind":
                            return String.fromCodePoint(128168);
                        case "fog":
                            return String.fromCodePoint(127787);
                        case "cloudy":
                            return String.fromCodePoint(9729);
                        case "partly-cloudy-day":
                        case "partly-cloudy-night":
                            return String.fromCodePoint(9925);
                        default:
                            return "";
                    }
                })();
                icon += String.fromCodePoint(0xFE0F);
                this.hourlyForecast.push({
                    time: new Date(h.time * 1000).toLocaleTimeString(),
                    temp: Math.round(h.temperature || 0) + String.fromCodePoint(0xB0),
                    icon: icon,
                    summary: h.summary,
                    precipProbability: Math.round(h.precipProbability * 100) + "%"
                });
            }
        } catch (e) {
            console.error(e);
            this.error(e.message || e.responseText || "An error occured.");
        }
    }

    configureSettings() {
        this.settingsModel(new SettingsViewModel(this));
        this.updateForecast();
    }
}

class SettingsViewModel {
    constructor(parent) {
        this.parent = parent;
        for (let name of ["twelveHourTime", "latitude", "longitude", "useGeolocation"]) {
            this[name] = ko.observable(parent[name]());
        }
    }

    saveSettings() {
        this.parent.twelveHourTime(!!this.twelveHourTime());
        this.parent.latitude(this.latitude() == "" ? null : +this.latitude());
        this.parent.longitude(this.longitude() == "" ? null : +this.longitude());
        this.parent.useGeolocation(!!this.useGeolocation());
        for (let name of["twelveHourTime", "latitude", "longitude", "useGeolocation"]) {
            ko.observable(this.parent[name](this[name]()));
        }
        this.parent.settingsModel(null);
        this.parent.updateForecast();
    }
}

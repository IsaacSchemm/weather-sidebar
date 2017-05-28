"use strict";

class WeatherViewModel {
    constructor() {
        this.settingsModel = ko.observable(null);

        this.twelveHourTime = ko.observable(true);
        this.defaultLatitude = ko.observable(null);
        this.defaultLongitude = ko.observable(null);
        this.useGeolocation = ko.observable(true);

        this.error = ko.observable(null);

        this.alerts = ko.observableArray();
        this.temperature = ko.observable(null);
        this.description = ko.observable(null);

        this.lastLatitude = null;
        this.lastLongitude = null;

        this.hourlyForecast = ko.observableArray();

        this.loadSettings();
    }

    // Loads and applies new settings from HTML local storage.
    loadSettings() {
        try {
            let json = localStorage.getItem("settings");
            if (json == null) return;
            let settings = JSON.parse(json);

            this.twelveHourTime(settings.twelveHourTime);
            this.defaultLatitude(settings.latitude);
            this.defaultLongitude(settings.longitude);
            this.useGeolocation(settings.useGeolocation);

            this.update();
        } catch (e) {
            console.error(e);
            this.error("Could not load settings.");
        }
    }

    // Returns a Promise that resolves to the current position or gets
    // rejected if the current position cannot be determined.
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!this.useGeolocation() || !navigator.geolocation) {
                reject();
                return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject);
        });
    }

    // Updates the location to use for forecasting, using either the actual
    // current location or the default defined in the settings.
    async update() {
        let coords;
        try {
            let location = await this.getCurrentPosition();
            coords = location.coords;
        } catch (e) {
            coords = {
                latitude: this.defaultLatitude(),
                longitude: this.defaultLongitude()
            };
        }

        // Limit precision of numbers to avoid unnecessary reloads of forecast
        coords = {
            latitude: +coords.latitude.toFixed(3),
            longitude: +coords.longitude.toFixed(3)
        };

        if (coords.latitude == this.lastLatitude && coords.longitude == this.lastLongitude) {
            console.log("Same location")
            return;
        }

        this.lastLatitude = coords.latitude;
        this.lastLongitude = coords.longitude;
        this.updateForecast();
    }

    // Updates the forecast information.
    async updateForecast() {
        try {
            if (this.lastLatitude == null || this.lastLongitude == null) {
                this.temperature(null);
                this.description(null);
                this.hourlyForecast([]);
                return;
            }

            let data = await $.getJSON(`proxy.ashx?url=${this.lastLatitude},${this.lastLongitude}`);
            console.log(data);

            this.alerts([]);
            for (let a of data.alerts || []) {
                let title = a.title;
                if (a.expires) {
                    title += ` (until ${new Date(a.expires * 1000).toLocaleString()})`
                }
                this.alerts.push({
                    title: title,
                    uri: a.uri,
                    severity: a.severity
                });
            }

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
    }
}

class SettingsViewModel {
    constructor(parent) {
        this.parent = parent;

        let json = localStorage.getItem("settings");
        if (json == null) return;
        let settings = JSON.parse(json);

        let numberToString = i => {
            if (i == null) return "";
            else return `${i}`;
        };

        this.twelveHourTime = ko.observable(settings.twelveHourTime);
        this.latitude = ko.observable(numberToString(settings.latitude));
        this.longitude = ko.observable(numberToString(settings.longitude));
        this.useGeolocation = ko.observable(settings.useGeolocation);
    }

    saveSettings() {
        let normalizeNumber = s => {
            if (s == null || s == "") return null;
            else return +s;
        };
        let settings = {
            twelveHourTime: !!this.twelveHourTime(),
            latitude: normalizeNumber(this.latitude()),
            longitude: normalizeNumber(this.longitude()),
            useGeolocation: !!this.useGeolocation()
        }
        localStorage.setItem("settings", JSON.stringify(settings));
        this.parent.settingsModel(null);
        this.parent.loadSettings();
    }
}

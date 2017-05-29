﻿"use strict";

class WeatherViewModel {
    constructor() {
        this.settingsModel = ko.observable(null);

        this.twelveHourTime = ko.observable(true);
        this.useLocationTime = ko.observable(true);
        this.defaultLatitude = ko.observable(null);
        this.defaultLongitude = ko.observable(null);
        this.useGeolocation = ko.observable(true);

        this.error = ko.observable(null);

        this.alerts = ko.observableArray();
        this.time = ko.observable(null);
        this.temperature = ko.observable(null);
        this.description = ko.observable(null);

        this.currentLatitude = ko.observable(null);
        this.currentLongitude = ko.observable(null);

        const deg = String.fromCodePoint(0xB0);
        this.currentLatitudeDisplay = ko.pureComputed(() =>
            `${Math.abs(this.currentLatitude() || 0)}${deg} ${this.currentLatitude > 0 ? "N" : "S"}`);
        this.currentLongitudeDisplay = ko.pureComputed(() =>
            `${Math.abs(this.currentLongitude() || 0)}${deg} ${this.currentLongitude > 0 ? "E" : "W"}`);
        this.mapLink = ko.pureComputed(() =>
            `https://www.google.com/maps/preview/@${this.currentLatitude()},${this.currentLongitude()},11z`);

        this.hourlyForecast = ko.observableArray();

        this.loadSettings();
    }

    // Loads and applies new settings from HTML local storage.
    loadSettings() {
        try {
            let json = localStorage.getItem("settings");
            if (json != null) {
                let settings = JSON.parse(json);

                this.twelveHourTime(settings.twelveHourTime);
                this.useLocationTime(settings.useLocationTime);
                this.defaultLatitude(settings.latitude);
                this.defaultLongitude(settings.longitude);
                this.useGeolocation(settings.useGeolocation);
            }

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

        if (coords.latitude == this.currentLatitude() && coords.longitude == this.currentLongitude()) {
            console.log("Same location")
            return;
        }

        this.currentLatitude(coords.latitude);
        this.currentLongitude(coords.longitude);
        this.updateForecast();
    }

    // Updates the forecast information.
    async updateForecast() {
        try {
            if (this.currentLatitude() == null || this.currentLongitude() == null) {
                this.time(null);
                this.temperature(null);
                this.description(null);
                this.hourlyForecast([]);
                return;
            }

            let data = null;
            for (let proxyPage of ["proxy.php", "proxy.ashx"]) {
                try {
                    data = await $.getJSON(`${proxyPage}?url=${this.currentLatitude()},${this.currentLongitude()}`);
                } catch (e) { }
            }
            console.log(data);

            if (data != null) {
                localStorage.setItem("lastForecastData", JSON.stringify(data));
            } else {
                this.error("Could not load data from the proxy");
                let lastDataStr = localStorage.getItem("lastForecastData");
                if (!lastDataStr) return;
                
                data = JSON.parse(lastDataStr);
            }

            let timezone = this.useLocationTime()
                ? data.timezone
                : moment.tz.guess();

            this.alerts([]);
            for (let a of data.alerts || []) {
                let title = a.title;
                if (a.expires) {
                    title += ` (until ${moment.tz(a.expires * 1000, timezone).format("h:mm A")})`
                }
                this.alerts.push({
                        title: title,
                        uri: a.uri,
                        severity: a.severity
                });
            }

            this.time(moment.tz(data.currently.time * 1000, timezone).format("h:mm A z"));
            this.temperature(Math.round(data.currently.temperature) + String.fromCodePoint(0xB0));
            this.description(data.currently.summary);

            this.hourlyForecast([]);
            for (let h of data.hourly.data.slice(0, 12)) {
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
                        time: moment.tz(h.time * 1000, timezone).format("h:mm A"),
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

        let numberToString = i => {
            if (i == null) return "";
            else return `${i}`;
        };

        this.twelveHourTime = ko.observable(parent.twelveHourTime());
        this.useLocationTime = ko.observable(parent.useLocationTime());
        this.latitude = ko.observable(numberToString(parent.defaultLatitude()));
        this.longitude = ko.observable(numberToString(parent.defaultLongitude()));
        this.useGeolocation = ko.observable(parent.useGeolocation());
    }

    saveSettings() {
        let normalizeNumber = s => {
            if (s == null || s == "") return null;
            else return +s;
        };
        let settings = {
            twelveHourTime: !!this.twelveHourTime(),
            useLocationTime: !!this.useLocationTime(),
            latitude: normalizeNumber(this.latitude()),
            longitude: normalizeNumber(this.longitude()),
            useGeolocation: !!this.useGeolocation()
        }
        localStorage.setItem("settings", JSON.stringify(settings));
        this.parent.settingsModel(null);
        this.parent.loadSettings();
    }
}
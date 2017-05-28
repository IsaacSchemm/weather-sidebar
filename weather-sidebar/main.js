"use strict";

class WeatherViewModel {
    constructor() {
        this.settingsModel = ko.observable(null);

        this.twelveHourTime = ko.observable(true);
        this.defaultLatitude = ko.observable(null);
        this.defaultLongitude = ko.observable(null);
        this.useGeolocation = ko.observable(true);

        this.error = ko.observable(null);
        this.temperature = ko.observable(null);
        this.description = ko.observable(null);

        this.lastLatitude = null;
        this.lastLongitude = null;

        this.hourlyForecast = ko.observableArray();

        this.loadSettings();
    }

    loadSettings(settings) {
        try {
            if (settings == null) {
                if (!window.localStorage) return;
                let json = localStorage.getItem("settings");
                if (json == null) return;
                settings = JSON.parse(json);
            }
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

    update() {
        this.updateLocation({
            latitude: this.defaultLatitude(),
            longitude: this.defaultLongitude()
        });

        if (this.useGeolocation() && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(l => this.updateLocation(l.coords));
        }
    }

    updateLocation(coords) {
        if (coords.latitude == this.lastLatitude && coords.longitude == this.lastLongitude) {
            console.log("Same location")
            return;
        }

        this.lastLatitude = coords.latitude;
        this.lastLongitude = coords.longitude;
        this.updateForecast();
    }

    async updateForecast() {
        try {
            if (this.lastLatitude == null || this.lastLongitude == null) {
                this.temperature(null);
                this.description(null);
                this.hourlyForecast([]);
                return;
            }

            let data = await $.getJSON(`proxy.ashx?url=${this.lastLatitude},${this.lastLongitude}`);
            
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
        let numberToString = i => {
            if (i == null) return "";
            else return `${i}`;
        };
        this.parent = parent;
        this.twelveHourTime = ko.observable(parent.twelveHourTime());
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
            latitude: normalizeNumber(this.latitude()),
            longitude: normalizeNumber(this.longitude()),
            useGeolocation: !!this.useGeolocation()
        }
        if (window.localStorage) {
            localStorage.setItem("settings", JSON.stringify(settings));
        }
        this.parent.settingsModel(null);
        this.parent.loadSettings(settings);
        this.parent.updateForecast();
    }
}

"use strict";

class WeatherViewModel {
    constructor() {
        this.settingsModel = ko.observable(null);

        this.twelveHourTime = ko.observable(true);
        this.latitude = ko.observable(47.6038);
        this.longitude = ko.observable(-122.3301);
        this.useGeolocation = ko.observable(true);

        this.error = ko.observable(null);
        this.temperature = ko.observable(70);
        this.description = ko.observable("Clear");

        this.hourlyForecast = ko.observableArray();

        this.updateForecast();
    }

    async updateForecast() {
        try {
            let data = await $.getJSON(`proxy.ashx?url=${this.latitude()},${this.longitude()}`);
            
            this.temperature(Math.round(data.currently.temperature));
            this.description(data.summary);

            this.hourlyForecast([]);
            for (let h of data.hourly.data) {
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
                    temp: Math.round(h.temperature) + String.fromCodePoint(0xB0),
                    icon: icon,
                    summary: h.summary
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
        for (let name of ["twelveHourTime", "latitude", "longitude", "useGeolocation"]) {
            this[name] = ko.observable(parent[name]());
        }
    }

    saveSettings() {
        for (let name of["twelveHourTime", "latitude", "longitude", "useGeolocation"]) {
            ko.observable(this.parent[name](this[name]()));
        }
        this.parent.settingsModel(null);
    }
}

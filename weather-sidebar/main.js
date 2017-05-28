class WeatherViewModel {
    constructor() {
        this.settingsModel = ko.observable(null);

        this.twelveHourTime = ko.observable(true);
        this.latitude = ko.observable(47.6038);
        this.longitude = ko.observable(-122.3301);
        this.useGeolocation = ko.observable(true);

        this.temperature = ko.observable(70);
        this.description = ko.observable("Clear");

        this.hourlyForecast = ko.observableArray([
            {
                time: "8:00 AM",
                temp: "40\u00B0",
                icon: String.fromCodePoint(9729),
                summary: "Cloudy"
            },
            {
                time: "9:00 AM",
                temp: "42\u00B0",
                icon: String.fromCodePoint(9925),
                summary: "Partly Cloudy"
            },
            {
                time: "10:00 AM",
                temp: "100\u00B0",
                icon: String.fromCodePoint(128262),
                summary: "Clear"
            },
            {
                time: "11:00 AM",
                temp: "38\u00B0",
                icon: String.fromCodePoint(127783),
                summary: "Rain"
            },
            {
                time: "12:00 PM",
                temp: "27\u00B0",
                icon: String.fromCodePoint(127784),
                summary: "Snow"
            },
            {
                time: "1:00 PM",
                temp: "-11\u00B0",
                icon: String.fromCodePoint(127784),
                summary: "Sleet"
            },
            {
                time: "2:00 PM",
                temp: "31\u00B0",
                icon: String.fromCodePoint(128168),
                summary: "Wind"
            },
            {
                time: "3:00 PM",
                temp: "40\u00B0",
                icon: String.fromCodePoint(127787),
                summary: "Fog"
            },
        ]);
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

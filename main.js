"use strict";

// Returns a Promise that resolves to the current coordinates or gets
// rejected if the current position cannot be determined. Coordinates are
// limited in precision to avoid unnecessary weather lookups due to small
// variations.
function getCurrentCoords() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject();
            return;
        }
        navigator.geolocation.getCurrentPosition(loc => resolve({
            latitude: +loc.coords.latitude.toFixed(3),
            longitude: +loc.coords.longitude.toFixed(3)
        }), reject);
    });
}

class WeatherViewModel {
    constructor() {
        this.settingsModel = ko.observable(null);

        // Settings
        this.twelveHourTime = ko.observable(true);
        this.useLocationTime = ko.observable(true);
        this.defaultLatitude = ko.observable(null);
        this.defaultLongitude = ko.observable(null);
        this.useGeolocation = ko.observable(true);
        this.theme = ko.observable("compact-light");

        this.error = ko.observable(null);

        // Weather information
        this.alerts = ko.observableArray();
        this.time = ko.observable(null);
        this.temperature = ko.observable(null);
        this.description = ko.observable(null);

        // Weather forecast
        this.hourlyForecast = ko.observableArray();

        // Coordinates used for the weather forecast - can come from settings or geolocation API
        this.currentLatitude = ko.observable(null);
        this.currentLongitude = ko.observable(null);

        // Display a Google Maps link to show the current location (since we don't have a geocode API)
        const deg = String.fromCodePoint(0xB0);
        this.currentLatitudeDisplay = ko.pureComputed(() =>
            `${Math.abs(this.currentLatitude() || 0)}${deg} ${this.currentLatitude > 0 ? "N" : "S"}`);
        this.currentLongitudeDisplay = ko.pureComputed(() =>
            `${Math.abs(this.currentLongitude() || 0)}${deg} ${this.currentLongitude > 0 ? "E" : "W"}`);
        this.mapLink = ko.pureComputed(() =>
            `https://www.google.com/maps/preview/@${this.currentLatitude()},${this.currentLongitude()},11z`);

        // Populate settings and load weather information
        this.loadSettings();
    }

    addToSidebar() {
        if (window.sidebar && window.sidebar.addPanel) {
            window.sidebar.addPanel(document.title, location.href, "");
        } else if (/Firefox/.test(navigator.userAgent)) {
            window.open("https://www.howtogeek.com/251625/how-to-load-a-website-in-firefoxs-sidebar/");
        } else if (/Vivaldi/.test(navigator.userAgent)) {
            window.open("https://help.vivaldi.com/article/web-panels/");
        } else {
            alert("It doesn't look like your browser has a feature to put web pages in the sidebar.");
        }
    }

    // Loads and applies new settings from HTML local storage.
    loadSettings() {
        try {
            let clockSettingsChanged = false;
            let json = localStorage.getItem("settings");
            if (json != null) {
                let settings = JSON.parse(json);

                // Clock settings
                if (this.twelveHourTime() != settings.twelveHourTime) {
                    this.twelveHourTime(settings.twelveHourTime);
                    clockSettingsChanged = true;
                }
                if (this.useLocationTime() != settings.useLocationTime) {
                    this.useLocationTime(settings.useLocationTime);
                    clockSettingsChanged = true;
                }

                // Location settings
                this.defaultLatitude(settings.latitude);
                this.defaultLongitude(settings.longitude);
                this.useGeolocation(settings.useGeolocation);

                this.theme(settings.theme || "compact-light");
            }

            // If one of the time display settings changed, we'll want to refresh.
            // Otherwise, we only need to refresh if our location has changed.
            this.update(clockSettingsChanged ? true : false);
        } catch (e) {
            console.error(e);
            this.error("Could not load settings.");
        }
    }

    // Updates the location to use for forecasting, using either the actual
    // current location or the default defined in the settings.
    async update(force) {
        this.error(null);

        let coords;
        try {
            // If the user has turned off geolocation, don't try to use it.
            if (!this.useGeolocation()) throw "Geolocation is turned off.";
            // Otherwise, ask for permission through the browser.
            coords = await getCurrentCoords();
        } catch (e) {
            // Use the coordinates from the settings.
            coords = {
                latitude: this.defaultLatitude(),
                longitude: this.defaultLongitude()
            };
            if (coords.latitude == null || coords.longitude == null) {
                this.error("No default latitude/longitude is defined in the settings.");
                return;
            }
        }

        if (!force && coords.latitude == this.currentLatitude() && coords.longitude == this.currentLongitude()) {
            console.log("Same location, not updating weather");
            return;
        }

        this.currentLatitude(coords.latitude);
        this.currentLongitude(coords.longitude);
        this.updateForecast();
    }

    // Updates the forecast information.
    async updateForecast() {
        this.error(null);

        try {
            let data = null;
            for (let proxyPage of ["proxy.php", "proxy.ashx"]) {
                try {
                    let response = await fetch(`${proxyPage}?url=${this.currentLatitude()},${this.currentLongitude()}`);
                    if (!response.ok) throw new Error(`Request to ${proxyPage} returned status ${response.status}`);
                    data = await response.json();
                } catch (e) {
                    console.warn(e);
                }
            }

            if (data == null) {
                this.error("Could not load data from the proxy");
                return;
            }

            console.log(data);

            let timezone = this.useLocationTime()
                ? data.timezone
                : moment.tz.guess();
            let format = this.twelveHourTime()
                ? "h:mm A"
                : "H:mm";

            this.alerts([]);
            for (let a of data.alerts || []) {
                let title = a.title;
                if (a.expires) {
                    title += ` (until ${moment.tz(a.expires * 1000, timezone).format(format)})`
                }
                this.alerts.push({
                    title: title,
                    uri: a.uri,
                    severity: a.severity
                });
            }

            this.time("Last updated: " + moment.tz(data.currently.time * 1000, timezone).format(format + " z"));
            this.temperature(Math.round(data.currently.temperature) + String.fromCodePoint(0xB0));
            this.description(data.currently.summary);

            this.hourlyForecast([]);
            for (let h of data.hourly.data.slice(0, 12)) {
                // Use an anonymous function to map an icon name to a Unicode icon
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
                
                // Display as emoji if possible
                icon += String.fromCodePoint(0xFE0F);

                this.hourlyForecast.push({
                    time: moment.tz(h.time * 1000, timezone).format(format),
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

        // Coordinated converted to string (or empty string) for input box
        let numberToString = i => {
            if (i == null) return "";
            else return `${i}`;
        };

        this.twelveHourTime = ko.observable(parent.twelveHourTime());
        this.useLocationTime = ko.observable(parent.useLocationTime());
        this.latitude = ko.observable(numberToString(parent.defaultLatitude()));
        this.longitude = ko.observable(numberToString(parent.defaultLongitude()));
        this.useGeolocation = ko.observable(parent.useGeolocation());

        // By using the same observable, the theme will update instantly
        this.theme = parent.theme;

        this.locationMessage = ko.observable("");
    }

    async getCurrentLocation() {
        this.locationMessage("Loading...");
        try {
            let coords = await getCurrentCoords();
            this.latitude(coords.latitude);
            this.longitude(coords.longitude);
        } catch (e) {
            alert("Could not detect your current location.");
        }
        this.locationMessage("");
    }

    resetSettings() {
        if (confirm("Are you sure you want to clear these settings?")) {
            localStorage.removeItem("settings");
            location.href = location.href;
        }
    }

    cancel() {
        this.parent.settingsModel(null);
    }

    saveSettings() {
        // Coordinates are saved in settings as number or null
        let normalizeNumber = s => {
            if (s == null || s == "") return null;
            else return +s;
        };
        let settings = {
            twelveHourTime: !!this.twelveHourTime(),
            useLocationTime: !!this.useLocationTime(),
            latitude: normalizeNumber(this.latitude()),
            longitude: normalizeNumber(this.longitude()),
            useGeolocation: !!this.useGeolocation(),
            theme: this.theme()
        }
        localStorage.setItem("settings", JSON.stringify(settings));
        this.parent.settingsModel(null);
        this.parent.loadSettings();
    }
}

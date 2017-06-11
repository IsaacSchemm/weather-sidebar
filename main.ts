﻿declare function fetch(url: string): Promise<any>;
declare var ko: any;
declare var moment: any;

if (!window.console) {
    (window as any).console = {
        log: () => { },
        warn: e => alert((e || {}).message || e),
        error: e => alert((e || {}).message || e)
    }
}

if (!Array.isArray) {
    (Array as any).isArray = function (arg) {
        return Object.prototype.toString.call(arg) === '[object Array]';
    };
}

if (!String.prototype.trim) {
    (String as any).prototype.trim = function () {
        return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
    };
}

function getCurrentCoords(): Promise<{
    latitude: number;
    longitude: number;
}> {
    // Returns a Promise that resolves to the current coordinates or gets
    // rejected if the current position cannot be determined. Coordinates are
    // limited in precision to avoid unnecessary weather lookups due to small
    // variations.
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

interface IAlert {
    title: string;
    uri: string;
    severity: string;
}

interface IForecast {
    time: string;
    temp: string;
    icon: string;
    summary: string;
    precipProbability: string;
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        const head = document.head || document.getElementsByTagName("head")[0];
        head.appendChild(s);
    });
}

class WeatherViewModel {
    readonly settingsModel;
    readonly aboutShown;

    readonly twelveHourTime;
    readonly useLocationTime;
    readonly hoursAhead;
    readonly defaultLatitude;
    readonly defaultLongitude;
    readonly useGeolocation;
    readonly theme;
    readonly useTwitterEmoji;

    readonly error;

    readonly alerts;
    readonly time;
    readonly temperature;
    readonly description;

    readonly hourlyForecast;

    readonly currentLatitude;
    readonly currentLongitude;

    readonly currentLatitudeDisplay;
    readonly currentLongitudeDisplay;
    readonly mapLink;

    constructor() {
        this.settingsModel = ko.observable(null);
        this.aboutShown = ko.observable(false);

        // Settings
        this.twelveHourTime = ko.observable(true);
        this.useLocationTime = ko.observable(true);
        this.hoursAhead = ko.observable(0);
        this.defaultLatitude = ko.observable("");
        this.defaultLongitude = ko.observable("");
        this.useGeolocation = ko.observable(true);
        this.theme = ko.observable("compact-light");
        this.useTwitterEmoji = ko.observable(true);
        if (/(Windows|OS X|iOS|Android)/.test(navigator.userAgent)) {
            if (!/(Windows NT [456]\.|OS X 10_[0123456]_)/.test(navigator.userAgent)) {
                this.useTwitterEmoji(false);
            }
        }

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
            `${Math.abs(this.currentLatitude() || 0)}${deg} ${this.currentLatitude() > 0 ? "N" : "S"}`);
        this.currentLongitudeDisplay = ko.pureComputed(() =>
            `${Math.abs(this.currentLongitude() || 0)}${deg} ${this.currentLongitude() > 0 ? "E" : "W"}`);
        this.mapLink = ko.pureComputed(() =>
            `https://www.google.com/maps/preview/@${this.currentLatitude()},${this.currentLongitude()},11z`);

        // Populate settings and load weather information
        this.loadSettings();
    }

    openInNewTab() {
        window.open(location.href, "_blank");
    }

    addToSidebar() {
        if (window["sidebar"] && window["sidebar"].addPanel) {
            (window as any).sidebar.addPanel(document.title, location.href, "");
        } else if (/Firefox/.test(navigator.userAgent)) {
            window.open("https://www.howtogeek.com/251625/how-to-load-a-website-in-firefoxs-sidebar/");
        } else if (/Vivaldi/.test(navigator.userAgent)) {
            window.open("https://help.vivaldi.com/article/web-panels/");
        } else {
            alert("It doesn't look like your browser has a feature to put web pages in the sidebar.");
        }
    }

    showAbout() {
        this.aboutShown(true);
    }

    hideAbout() {
        this.aboutShown(false);
    }

    // Loads and applies new settings from HTML local storage.
    async loadSettings() {
        try {
            let displaySettingsChanged = false;
            if (!window.localStorage) {
                await loadScript("http://unpkg.com/localstorage-browser-polyfill/localstorage-browser-polyfill.js");
            }
            let json = localStorage.getItem("weather-settings");
            if (json == null) {
                json = localStorage.getItem("settings");
                if (json) {
                    localStorage.setItem("weather-settings", json);
                    localStorage.removeItem("settings");
                }
            }
            if (json != null) {
                if (!window["JSON"]) {
                    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/json3/3.3.2/json3.min.js");
                }
                let settings = JSON.parse(json);
                settings.hoursAhead = settings.hoursAhead || 12;

                // Clock settings
                if (this.twelveHourTime() != settings.twelveHourTime) {
                    this.twelveHourTime(settings.twelveHourTime);
                    displaySettingsChanged = true;
                }
                if (this.useLocationTime() != settings.useLocationTime) {
                    this.useLocationTime(settings.useLocationTime);
                    displaySettingsChanged = true;
                }
                if (this.hoursAhead() != settings.hoursAhead) {
                    this.hoursAhead(settings.hoursAhead);
                    displaySettingsChanged = true;
                }
                if (this.useTwitterEmoji() != settings.useTwitterEmoji) {
                    this.useTwitterEmoji(settings.useTwitterEmoji);
                    displaySettingsChanged = true;
                }

                // Location settings
                this.defaultLatitude(settings.latitude);
                this.defaultLongitude(settings.longitude);
                this.useGeolocation(settings.useGeolocation);
                this.useTwitterEmoji(settings.useTwitterEmoji);

                this.theme(settings.theme || "compact-light");
            }

            // If one of the time display settings changed, we'll want to refresh.
            // Otherwise, we only need to refresh if our location has changed.
            this.update(displaySettingsChanged ? true : false);
        } catch (e) {
            console.error(e);
            this.error("Could not load settings.");
        }
    }

    // Updates the location to use for forecasting, using either the actual
    // current location or the default defined in the settings.
    async update(force) {
        this.error(null);

        let coords: {
            latitude: number | string;
            longitude: number | string;
        };
        try {
            if (!window["fetch"]) {
                await loadScript("https://cdnjs.cloudflare.com/ajax/libs/fetch/2.0.3/fetch.js");
            }

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

    async emojiStr(codePoint: number | null) {
        if (codePoint == null) return "";
        const str = String.fromCodePoint(codePoint) + String.fromCodePoint(0xFE0F);
        if (this.useTwitterEmoji()) {
            if (!window["twemoji"]) {
                await loadScript("https://twemoji.maxcdn.com/2/twemoji.min.js?2.3.0");
            }
            return window["twemoji"].parse(str);
        } else {
            return str;
        }
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
                    if (data) break;
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
            this.temperature(Math.round(data.currently.temperature) + String.fromCharCode(0xB0));
            this.description(data.currently.summary);

            this.hourlyForecast([]);
            for (let h of data.hourly.data.slice(1, this.hoursAhead() + 1)) {
                // Use an anonymous function to map an icon name to a Unicode icon
                const codePoint = (() => {
                    switch (h.icon) {
                        case "clear-day":
                        case "clear-night":
                            return 9728;
                        case "rain":
                            return 127783;
                        case "snow":
                        case "sleet":
                            return 127784;
                        case "wind":
                            return 128168;
                        case "fog":
                            return 127787;
                        case "cloudy":
                            return 9729;
                        case "partly-cloudy-day":
                        case "partly-cloudy-night":
                            return 9925;
                        default:
                            return null;
                    }
                })();
                const icon = await this.emojiStr(codePoint);

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
    readonly parent: WeatherViewModel;

    readonly twelveHourTime;
    readonly useLocationTime;
    readonly hoursAhead;
    readonly latitude;
    readonly longitude;
    readonly useGeolocation;

    readonly theme;
    readonly useTwitterEmoji;

    readonly locationMessage;

    constructor(parent) {
        this.parent = parent;
        
        this.twelveHourTime = ko.observable(parent.twelveHourTime());
        this.useLocationTime = ko.observable(parent.useLocationTime());
        this.hoursAhead = ko.observable(parent.hoursAhead());
        this.latitude = ko.observable(parent.defaultLatitude());
        this.longitude = ko.observable(parent.defaultLongitude());
        this.useGeolocation = ko.observable(parent.useGeolocation());
        this.useTwitterEmoji = ko.observable(parent.useTwitterEmoji());

        // By using the same observable, the theme will update instantly
        this.theme = parent.theme;

        this.locationMessage = ko.observable("");
    }

    async getCurrentLocation() {
        this.locationMessage("Loading...");
        try {
            let coords = await getCurrentCoords();
            this.latitude(coords.latitude + "");
            this.longitude(coords.longitude + "");
        } catch (e) {
            alert("Could not detect your current location.");
        }
        this.locationMessage("");
    }

    resetSettings() {
        if (confirm("Are you sure you want to clear these settings?")) {
            localStorage.removeItem("weather-settings");
            location.href = location.href;
        }
    }

    cancel() {
        this.parent.settingsModel(null);
        this.parent.loadSettings();
    }

    saveSettings() {
        // Coordinates are saved in settings as string
        let settings = {
            twelveHourTime: !!this.twelveHourTime(),
            useLocationTime: !!this.useLocationTime(),
            hoursAhead: +this.hoursAhead(),
            latitude: this.latitude(),
            longitude: this.longitude(),
            useGeolocation: !!this.useGeolocation(),
            useTwitterEmoji: !!this.useTwitterEmoji(),
            theme: this.theme()
        }
        localStorage.setItem("weather-settings", JSON.stringify(settings));
        this.parent.settingsModel(null);
        this.parent.loadSettings();
    }
}

interface StringConstructor {
    fromCodePoint(codePoint: number): string;
}
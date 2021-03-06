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

const WeatherSupportedLanguages = [
    { code: "ar", name: "Arabic" },
    { code: "az", name: "Azerbaijani" },
    { code: "be", name: "Belarusian" },
    { code: "bg", name: "Bulgarian" },
    { code: "bs", name: "Bengali" },
    { code: "bs", name: "Bosnian" },
    { code: "ca", name: "Catalan" },
    { code: "cs", name: "Czech" },
    { code: "da", name: "Danish" },
    { code: "de", name: "German" },
    { code: "el", name: "Greek" },
    { code: "en", name: "English" },
    { code: "eo", name: "Esperanto" },
    { code: "es", name: "Spanish" },
    { code: "et", name: "Estonian" },
    { code: "fi", name: "Finnish" },
    { code: "fr", name: "French" },
    { code: "he", name: "Hebrew" },
    { code: "hi", name: "Hindi" },
    { code: "hr", name: "Croatian" },
    { code: "hu", name: "Hungarian" },
    { code: "id", name: "Indonesian" },
    { code: "is", name: "Icelandic" },
    { code: "it", name: "Italian" },
    { code: "ja", name: "Japanese" },
    { code: "ka", name: "Georgian" },
    { code: "kn", name: "Kannada" },
    { code: "ko", name: "Korean" },
    { code: "kw", name: "Cornish" },
    { code: "lv", name: "Latvian" },
    { code: "ml", name: "Malayam" },
    { code: "mr", name: "Marathi" },
    { code: "nb", name: "Norwegian (Bokmål)" },
    { code: "nl", name: "Dutch" },
    { code: "pa", name: "Punjabi" },
    { code: "pl", name: "Polish" },
    { code: "pt", name: "Portuguese" },
    { code: "ro", name: "Romanian" },
    { code: "ru", name: "Russian" },
    { code: "sk", name: "Slovak" },
    { code: "sl", name: "Slovenian" },
    { code: "sr", name: "Serbian" },
    { code: "sv", name: "Swedish" },
    { code: "ta", name: "Tamil" },
    { code: "te", name: "Telgu" },
    { code: "tet", name: "Tetum" },
    { code: "tr", name: "Turkish" },
    { code: "uk", name: "Ukrainian" },
    { code: "ur", name: "Urdu" },
    { code: "zh", name: "Chinese (Simplified)" },
    { code: "zh-tw", name: "Chinese (Traditional)" }
];

const WeatherDefaultSettings = {
    units: "auto",
    displayHumidity: true,
    twelveHourTime: true,
    useLocationTime: true,
    hoursAhead: 8,
    daysAhead: 0,
    defaultLatitude: 0,
    defaultLongitude: 0,
    useGeolocation: true,
    theme: "native",
    useTwitterEmoji: (() => {
        if (/(Windows|OS X|iOS|Android)/.test(navigator.userAgent)) {
            if (!/(Windows NT [456]\.|OS X 10_[0123456]_)/.test(navigator.userAgent)) {
                return false;
            }
        }
        return true;
    })()
};

class WeatherViewModel {
    readonly settingsModel;
    readonly aboutShown;

    readonly language;
    readonly units;
    readonly displayHumidity;
    readonly twelveHourTime;
    readonly useLocationTime;
    readonly hoursAhead;
    readonly daysAhead;
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
    readonly dailyForecast;

    readonly currentLatitude;
    readonly currentLongitude;

    readonly currentLatitudeDisplay;
    readonly currentLongitudeDisplay;
    readonly mapLink;

    constructor() {
        this.settingsModel = ko.observable(null);
        this.aboutShown = ko.observable(false);

        // Settings
        this.language = ko.observable("");
        this.units = ko.observable("auto");
        this.twelveHourTime = ko.observable(true);
        this.displayHumidity = ko.observable(true);
        this.useLocationTime = ko.observable(true);
        this.hoursAhead = ko.observable(0);
        this.daysAhead = ko.observable(0);
        this.defaultLatitude = ko.observable(null);
        this.defaultLongitude = ko.observable(null);
        this.useGeolocation = ko.observable(true);
        this.theme = ko.observable("compact-light");
        this.useTwitterEmoji = ko.observable(true);

        this.error = ko.observable(null);

        // Weather information
        this.alerts = ko.observableArray();
        this.time = ko.observable(null);
        this.temperature = ko.observable(null);
        this.description = ko.observable(null);

        // Weather forecast
        this.hourlyForecast = ko.observableArray();
        this.dailyForecast = ko.observableArray();

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
        (window as any).sidebar.addPanel(document.title, location.href, "");
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
                await loadScript("lib/localstorage-browser-polyfill.js");
            }
            let json = localStorage.getItem("weather-settings");
            if (json == null) {
                json = localStorage.getItem("settings");
                if (json) {
                    localStorage.setItem("weather-settings", json);
                    localStorage.removeItem("settings");
                }
            }
            if (!window["JSON"]) {
                await loadScript("lib/json3.min.js");
            }

            let settings = { ...WeatherDefaultSettings, ...JSON.parse(json || "{}") };

            // Clock settings
            if (this.language() !== settings.language) {
                this.language(settings.language);
                displaySettingsChanged = true;
            }
            if (this.units() !== settings.units) {
                this.units(settings.units);
                displaySettingsChanged = true;
            }
            if (this.twelveHourTime() !== settings.twelveHourTime) {
                this.twelveHourTime(settings.twelveHourTime);
                displaySettingsChanged = true;
            }
            if (this.useLocationTime() !== settings.useLocationTime) {
                this.useLocationTime(settings.useLocationTime);
                displaySettingsChanged = true;
            }
            if (this.hoursAhead() !== settings.hoursAhead) {
                this.hoursAhead(settings.hoursAhead);
                displaySettingsChanged = true;
            }
            if (this.daysAhead() !== settings.daysAhead) {
                this.daysAhead(settings.daysAhead);
                displaySettingsChanged = true;
            }
            if (this.useTwitterEmoji() !== settings.useTwitterEmoji) {
                this.useTwitterEmoji(settings.useTwitterEmoji);
                displaySettingsChanged = true;
            }

            // Display settings that don't require re-post
            this.displayHumidity(settings.displayHumidity);

            // Location settings
            this.defaultLatitude(settings.latitude);
            this.defaultLongitude(settings.longitude);
            this.useGeolocation(settings.useGeolocation);
            this.useTwitterEmoji(settings.useTwitterEmoji);

            this.theme(settings.theme || "compact-light");

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

        if (!force && coords.latitude === this.currentLatitude() && coords.longitude === this.currentLongitude()) {
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
                await loadScript("//twemoji.maxcdn.com/2/twemoji.min.js?2.3.0");
            }
            return window["twemoji"].parse(str);
        } else {
            return str;
        }
    }

    static getEmojiFromIconStr(icon: string) {
        switch (icon) {
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
    }

    getLanguage() {
        if (this.language()) return this.language();

        const supportedLanguages = WeatherSupportedLanguages.map(o => o.code);
        let languages: string[] = (navigator as any).languages || [navigator.language || (navigator as any).userLanguage];
        for (let l of languages) {
            let index = supportedLanguages.indexOf(l.toLowerCase());
            if (index >= 0) {
                return supportedLanguages[index];
            }
        }
        for (let l of languages) {
            let index = supportedLanguages.indexOf(l.substr(0, l.indexOf("-")).toLowerCase());
            if (index >= 0) {
                return supportedLanguages[index];
            }
        }
        return "fr";
    }

    // Updates the forecast information.
    async updateForecast() {
        this.error(null);

        try {
            let data = null;
            for (let proxyPage of ["proxy.php", "proxy.ashx"]) {
                try {
                    let response = await fetch(`${proxyPage}?url=${this.currentLatitude()},${this.currentLongitude()}&units=${this.units()}&lang=${this.getLanguage()}`);
                    if (!response.ok) throw new Error(`Request to ${proxyPage} returned status ${response.status}`);
                    data = await response.json();
                    if (data) break;
                } catch (e) {
                    console.warn(e);
                }
            }

            if (data == null) {
                this.error("Could not load data from the proxy. Try manually defining your latitude/longitude in the settings.");
                return;
            }

            let timezone = this.useLocationTime()
                ? data.timezone
                : moment.tz.guess();
            let timeFormat = this.twelveHourTime()
                ? "h:mm A"
                : "H:mm";

            this.alerts([]);
            for (let a of data.alerts || []) {
                let title = a.title;
                if (a.expires) {
                    title += ` (until ${moment.tz(a.expires * 1000, timezone).format("dddd " + timeFormat)})`;
                }
                this.alerts.push({
                    title: title,
                    uri: a.uri,
                    severity: a.severity
                });
            }

            this.time("Last updated: " + moment.tz(data.currently.time * 1000, timezone).format(timeFormat + " z"));
            this.temperature(Math.round(data.currently.temperature) + String.fromCharCode(0xB0));
            this.description(data.currently.summary);

            this.hourlyForecast([]);
            for (let h of data.hourly.data.slice(1, this.hoursAhead() + 1)) {
                const icon = await this.emojiStr(WeatherViewModel.getEmojiFromIconStr(h.icon));

                this.hourlyForecast.push({
                    time: moment.tz(h.time * 1000, timezone).format(timeFormat),
                    temp: Math.round(h.temperature || 0) + String.fromCodePoint(0xB0),
                    icon: icon,
                    summary: h.summary,
                    precipProbability: Math.round(h.precipProbability * 100) + "%"
                });
            }
            this.dailyForecast([]);
            for (let h of data.daily.data.slice(0, this.daysAhead())) {
                const icon = await this.emojiStr(WeatherViewModel.getEmojiFromIconStr(h.icon));

                this.dailyForecast.push({
                    time: moment.tz(h.time * 1000, timezone).format("dddd"),
                    tempMax: Math.round(h.temperatureMax || 0) + String.fromCodePoint(0xB0),
                    tempMin: Math.round(h.temperatureMin || 0) + String.fromCodePoint(0xB0),
                    humidity: h.humidity == null ? null : Math.round(h.humidity * 100),
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

    readonly language;
    readonly units;
    readonly displayHumidity;
    readonly twelveHourTime;
    readonly useLocationTime;
    readonly hoursAhead;
    readonly daysAhead;
    readonly latitude;
    readonly longitude;
    readonly useGeolocation;
    readonly useTwitterEmoji;

    readonly theme;
    readonly languageOptions;

    readonly locationMessage;

    constructor(parent) {
        this.parent = parent;

        this.language = ko.observable(parent.language());
        this.units = ko.observable(parent.units());
        this.displayHumidity = ko.observable(parent.displayHumidity());
        this.twelveHourTime = ko.observable(parent.twelveHourTime());
        this.useLocationTime = ko.observable(parent.useLocationTime());
        this.hoursAhead = ko.observable(parent.hoursAhead());
        this.daysAhead = ko.observable(parent.daysAhead());
        this.latitude = ko.observable(parent.defaultLatitude());
        this.longitude = ko.observable(parent.defaultLongitude());
        this.useGeolocation = ko.observable(parent.useGeolocation());
        this.useTwitterEmoji = ko.observable(parent.useTwitterEmoji());

        // By using the same observable, the theme will update instantly
        this.theme = parent.theme;

        // List of languages
        this.languageOptions = [{ code: "", name: "Auto (default)" }].concat(WeatherSupportedLanguages.slice().sort((a, b) => a.name.localeCompare(b.name)));

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
        let settings = {
            language: this.language(),
            units: this.units(),
            displayHumidity: !!this.displayHumidity(),
            twelveHourTime: !!this.twelveHourTime(),
            useLocationTime: !!this.useLocationTime(),
            hoursAhead: +this.hoursAhead(),
            daysAhead: +this.daysAhead(),
            latitude: this.latitude(),
            longitude: this.longitude(),
            useGeolocation: !!this.useGeolocation(),
            useTwitterEmoji: !!this.useTwitterEmoji(),
            theme: this.theme()
        };
        localStorage.setItem("weather-settings", JSON.stringify(settings));
        this.parent.settingsModel(null);
        this.parent.loadSettings();
    }
}

interface StringConstructor {
    fromCodePoint(codePoint: number): string;
}

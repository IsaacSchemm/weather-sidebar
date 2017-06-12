using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Web;

namespace weather_sidebar {
    /// <summary>
    /// Server-side proxy for Dark Sky API
    /// </summary>
    public class proxy : IHttpHandler {

        public void ProcessRequest(HttpContext context) {
            string apiKey = Key.DarkSkyKey;

            string url_parameter = context.Request.QueryString["url"];
            if (string.IsNullOrEmpty(context.Request.QueryString["url"])) {
                context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
                return;
            }

            string url = $"https://api.darksky.net/forecast/{apiKey}/{url_parameter}?exclude=minutely";
            if (!string.IsNullOrEmpty(context.Request.QueryString["lang"])) {
                url += "&lang=" + context.Request.QueryString["lang"];
            }
            if (!string.IsNullOrEmpty(context.Request.QueryString["units"])) {
                url += "&units=" + context.Request.QueryString["units"];
            }
            var request = WebRequest.CreateHttp(url);
            try {
                var darkSkyResp = request.GetResponse();

                var statusCode = (darkSkyResp as HttpWebResponse)?.StatusCode ?? HttpStatusCode.OK;
                context.Response.StatusCode = (int)statusCode;

                darkSkyResp.GetResponseStream().CopyTo(context.Response.OutputStream);
                context.Response.OutputStream.Flush();
            } catch (WebException e) {
                var statusCode = (e.Response as HttpWebResponse)?.StatusCode ?? HttpStatusCode.InternalServerError;
                context.Response.StatusCode = (int)statusCode;
            }
        }

        public bool IsReusable {
            get {
                return false;
            }
        }
    }
}
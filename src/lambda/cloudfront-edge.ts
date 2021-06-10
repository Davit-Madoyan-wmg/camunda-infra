// exports.handler = (event, context, callback) => {
  
//   // Environment variables
//   const { BUCKET_WEBSITE_ENDPOINT } = process.env;
  
//   // Get the request object.
//   const request = event.Records[0].cf.request;

//   // Get the host from the request and take out "www." from the host if it exists.
//   let host = request.headers.host[0].value;
//   host = host.replace(/^www\./, '');
  
//   // Check if the host contains a subdomain.
//   // Eg. support.example.com <-- true
//   // Eg. example.com <-- false
  
//   // If it has a subdomain, get the path to the directory where the React app's static files are stored based on the subdomain's identifier (marketing, support, portal).
//   // If it doesn't have a subdomain, there will be no need for a  path because the static files will be at the root of the bucket, so return an empty string.
//   const subdomainPattern = /^[a-z\-0-9]+\.carpathia\.wmg\.com/;
//   const dir = subdomainPattern.test(host) ? host.split(".")[0] : undefined;
//   const entryPoint = dir ? `/${dir}` : '/dev';

//   // Declare the website endpoint of your Custom Origin.
//   const domain = BUCKET_WEBSITE_ENDPOINT;
  
//   // Instruct to send the request to the S3 bucket, specifying for it to look for content within the sub-directory or at the root.
//   // The key here is the 'path' property. It specifies the entry point.  It does not affect the request URI (eg. /login). 
//   request.origin = {
//     custom: {
//       domainName: domain,
//       port: 80,
//       protocol: "http",
//       path: entryPoint,
//       sslProtocols: ["TLSv1.1", "TLSv1.2"],
//       readTimeout: 5,
//       keepaliveTimeout: 5,
//       customHeaders: {
//         // Set a referer request header to gain access to read objects in the S3 bucket.
//         referer : [{ key: "referer", value: `http://${host}/` }]
//       }
//     }
//   };
  
//   // Change the host in the request headers to match the S3 bucket's website endpoint.
//   request.headers["host"] = [{ key: "host", value: domain }];
//   callback(null, request);
// };

# Backend Project from Hitesh Sir's Chai aur Code Channel

- [Model Link](https://app.eraser.io/workspace/YtPqZ1VogxGy1jzIDkzj)

- HTTP Headers:
    - HTTP Headers are the metadata which are the key-value pairs sent along with "Request" & "Response"
    - We can also create our own Headers
    - Request Headers basically contain info about request, like where it came from, who sent request, etc.
    - Response Headers contain info about respose sent by server, like status of the response(404, 200), etc.

- Some categories of Headers:
    - Request Headers -> from client
    - Response Headers -> from server
    - Representation Headers -> encoding/compression -> used to show data is in which encoding/compression
    - Payload Headers -> data -> used send data in headers, like _id, name, email, etc.

- There are many other types of Headers


- Most Common Headers
    - Accept : shows which kind of data it accepts -> ex. application/json
    - User-Agent : shows that request came from which application
    - Authorization : used send Bearer Token
    - Content-Type : images, pdfs, videos, etc.
    - Cookie : Cookies info(expiratin time, etc.)
    - Cache-Control : when to expire data

- CORS Headers
    - Access-Control-Allow-Origin
    - Access-Control-Allow-Credentials
    - Access-Control-Allow-Method

- Security
    - Cross-Origin-Embedder-Policy
    - Cross-Origin-Opener-Policy
    - Content-Security-Policy
    - X-XSS-Protection

- HTTP Methods
    - Basic set of operations that can be used to interact with server

    - GET : retrive a resource
    - HEAD : No message body (response header only)
    - OPTIONS : What operrations are available
    - TRACE : Loopback test (generally used for debugging purposes)
    - DELETE : remove a resource
    - PUT : replace a resource
    - POST : interact with resource (mostly add)
    - PATCH : change part of a resource

- HTTP Status Code
    - 1xx -> Informational
    - 2xx -> Success
    - 3xx -> Redirection
    - 4xx -> Client Error
    - 5xx -> Server Error

- 100 Continue          
- 102 Processing
- 200 OK
- 201 Created
- 202 Accepted
- 307 temporary redirect
- 308 permanent redirect
- 400 Bad Request
- 401 Unauthorized
- 402 Payment Required
- 404 Not Found
- 500 Internal Server Error
- 504 Gateway Timeout
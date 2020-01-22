const fs = require('fs');
const config = { port: process.env.OPENSHIFT_NODEJS_PORT || process.env.VCAP_APP_PORT || process.env.PORT || process.argv[2] || 8760 };
const Monarch = require('../dist/mid.cjs');
let http
const requestHandler = (req, res) => {
    if(req.url === "/dist/mid.umd.js"){
        res.writeHead(200, {'Content-Type': 'text/javascript'});
        res.end(fs.readFileSync(__dirname + '/../dist/mid.umd.js'))
    }else{
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.write('<script src="../dist/mid.umd.js"></script>');
        res.end();
    }
}

if(process.env.HTTPS_KEY){
    config.key = fs.readFileSync(process.env.HTTPS_KEY);
    config.cert = fs.readFileSync(process.env.HTTPS_CERT);
    http = require('https')
    config.server = http.createServer(config);
} else {
    http = require('http')
    config.server = http.createServer(requestHandler);
}

  


const I = Monarch({web: config.server.listen(config.port),http,fullPeer:true,dev:'http://localhost:8765/snap'})

console.log('Monarch peer started on ' + config.port + ' with /monarch');

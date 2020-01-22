"use strict";
import * as util from './util.js'
let gbGet
import * as nEnv from './node/mutil'
import * as wEnv from './browser/mutil'
const {crypto,WebSocket} = Object.assign({},nEnv,wEnv)
import Aegis from './aegis';
import Monarch from './monarch-api';

//can use this without needing root.
export const aegis = new Aegis(crypto)
export const monarch = new Monarch(aegis)
//export const courier = new Courier(WebSockets)??
export function Client(opts,config){
    opts = opts || {}
    let root = this
    root.state = {initTime:Date.now(),ready:false,seen:new Set()}
    root.util = Object.assign({},util,{Buffer:Buffer})
    root.opt = opts
    if(config.http){
        const options = {
            host: 'ipv4bot.whatismyipaddress.com',
            port: 80,
            path: '/'
        };
        config.http.get(options, function(res) {
            console.log("status: " + res.statusCode);
        
            res.on("data", function(chunk) {
                console.log("IP Address: " + chunk);
            });
        }).on('error', function(e) {
            console.error("Cannot get IP Address: " + e.message);
        });
    }
    root.store = config.store
    root.monarch = monarch
    root.aegis = aegis
    /*
    stateful things:
    .api, calls need to wait if client is not ready for sending

    */
    
    

  
}
function initRoot(root){
    const toRun = root.peer.isPeer?[pid,peers,chains,auth,initial,bootstrap,update]:[pid,peers,chains,initial,bootstrap]
    run()
    function run(){
        if(!toRun.length){done();return}
        let next = toRun.shift()
        next()
    }
    function pid(){
        root.store.getKey(Buffer.from([0,0]),async function(err,auth){
            if(auth){
                let [pid,priv,pub,pubsig,iv,stateSig,date,addr,owner] = auth
                if(!root.peer.isPeer){root.peer.id = pid;return}
                let version = date
                if((typeof root.opt.address === 'string' && addr !== root.opt.address)){
                    addr = root.opt.address;
                    date = Date.now()
                }
                if(root.opt.owner && Buffer.from(root.opt.owner).compare(Buffer.from(owner))){
                    owner = root.opt.owner;
                    date = Date.now()
                }
                let proof = await root.monarch.authPeer(version,priv,pub,pubsig,iv,stateSig,date,addr,owner)
                if(version !== date)root.store.putKey(Buffer.from([0,0]),proof)
                else run()
            }else{
                auth = await root.monarch.newPID(24)
                root.store.putKey(Buffer.from([0,0]),auth)
                if(!root.peer.isPeer){root.peer.id = BitID(auth[0])}
                run()
            }
        })
    }
    function peers(){
        //load cached peers and restore root.mesh
        run()
    }
    function chains(){
        //load cached chains and restore root.crowds
        run()
    }
    function auth(){
        //if our peer proof says we are owned, then verify the owners cid on our local machine
        run()
        return
        if(!root.peer.owner instanceof BitID){run();return}
        let them = root.crowd.people.get(root.peer.owner)
        if(!them || (them && !them.peers.has(root.peer.id))){root.peer.owner = false;run();return}

        //root.peer.owner = cid
    }
    function initial(){
        run()
    }
    function bootstrap(){
        run()
    }
    function update(){
        run()
    }
    function done(){
        if(root.peer.isPeer){
            commsInit(root)//listen on port
        }
        root.event.emit('ready',true)
    }
    //check for PID
    //check for network chains
    //check for network peers
    //check for Auth info
    //connect to initialPeer(s)
    //find/connect to network peers
    //find/update network chains we are watching
}

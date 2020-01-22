import {Client} from '../client'
import Disk from './disk'
import Listen from './listen'
import Store from '../store'

const nodeOpts = {
    allocate: Infinity,//entire disk space
    log: console.log,
    debug: function(){},
    warn: console.warn,
    path:__dirname+'/../../DATA_STORE',
    disk:Disk
}
export default function API(opts){
    if(!new.target){ return new API(opts) }
    const options = Object.assign({},nodeOpts,opts)
    let config
    if(options.electron){//basically browser, but in nodejs
        config = {
            electron:true
        }
    }else if(options.homePeer){//full peer, except they need a proxy in the clear web to get data
        //since this is a pseudo peer, it needs to stay synced as if it were a full peer
        //basically this is a full peer, except people can only connect to it through a proxy
        //so it is not directly routable
        config = {
            homePeer:true,
        }
    }else if(options.fullPeer){
        //this can have static IP OR could be a home router (will have to keep updating it's IP)
        //this is something that can be connected to and is the basis of the network
        config = {
            fullPeer:true,
            listen:Listen, //this is our nodejs socket handler
            web:options.web, //this is so we can listen for websockets
            http:options.http //need http so we can send a get request to get our IP addr
        }
        if(config.isPeer && !(config.listen && config.web && config.http)){
            throw new Error('To start a full peer, you must include all of the following options:',Object.keys(config).filter((x)=>!['store','isPeer'].includes(x)).join(', '))
        }
    }else{
        throw new Error('Must specify the context of this NodeJS instance. Should be one of: electron, homePeer, fullPeer')
    }
    config.store = new Store(options,options.disk)
    const root = new Client(options,config)
    //shield the root internals from the api
    Object.assign(this,root.api)
    
    //root.init()
}
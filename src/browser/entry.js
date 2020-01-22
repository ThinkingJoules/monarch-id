import {Client} from '../client'
import Disk from './disk'
import Store from '../store'


const browserOpts = {
    allocate: 1024*1024*5,//(5mb)..not sure..
    log: console.log,
    debug: function(){},
    warn: console.warn,
    disk:Disk
}
export default function You(opts){
    if(!new.target){ return new You(opts) }
    const options = Object.assign({},browserOpts,opts)
    let config
    if(options.homePeer){//full peer, except they need a proxy in the clear web to get data
        //since this is a pseudo peer, it needs to stay synced as if it were a full peer
        //basically this is a full peer, except people can only connect to it through a proxy
        //so it is not directly routable
        config = {//technically if they had a large enough indexeddb and they kept the browser open, it would work.
            homePeer:true,
        }
    }else{
        config = {browser:true}
    }
    config.store = new Store(options,options.disk)
    const root = new Client(options,config)
    console.log(root)
    //shield the root internals from the api
    Object.assign(this,root.api)
    
    //root.init()
}

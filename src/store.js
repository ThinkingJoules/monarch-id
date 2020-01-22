
export default function Store(root,Disk){
    let store = this
    store.mem = new Map()
    store.lru = new Map()
    store.disk = new Disk(root)
    store.get = function(key,cb,txn){
        let openedTxn
        txn = txn || store.disk && (openedTxn=true) && store.disk.rTxn()
        if(!(key instanceof Buffer)){throw new Error('Key must be a Buffer')}
        let val
        if(!(val = store.mem.get(key.toString('binary')))){
            if(txn)txn.get(key,(e,val)=>{cb.call(cb,e,val)})
            else cb.call(cb,false,undefined)
        }else{
            cb.call(cb,false,val)
        }
        if(txn && openedTxn){txn.commit()}
    }
    store.put = function(key,val,cb,txn,noMem,noDisk){
        let openedTxn
        txn = txn || store.disk && (openedTxn=true) && store.disk.rwTxn()
        if(!(key instanceof Buffer)){throw new Error('Key must be a Buffer')}
        if(!noMem)store.mem.set(key.toString('binary'),val)//when to evict from mem???
        if(txn && !noDisk)txn.put(key,val,cb)
        if(noDisk)cb.call(cb,false,true)
        if(txn && openedTxn){txn.commit()}
    }
    store.del = function(key,cb,txn){
        let openedTxn
        txn = txn || store.disk && (openedTxn=true) && store.disk.rwTxn()
        if(!(key instanceof Buffer)){throw new Error('Key must be a Buffer')}
        store.mem.delete(key.toString('binary'))
        if(txn)txn.del(key,cb)
        else cb.call(cb,false,true)
        if(txn && openedTxn){txn.commit()}
    }


    
    
    
}
import EventEmitter from 'eventemitter3'
export function StateMachineKey(key,isInput,test,pack,args,setter,isAsync){
    return [key,{key,test,pack,args,setter,isAsync,isInput}]

}
export function buildStateMachine(configMap,Proto){
    let stateMasks = Math.ceil(configMap.length/8)
    let packMasks = Math.ceil(configMap.filter((x)=>{return !!x[1].pack}).length/8)
    let packOrder = new Set(Array.from({length:packMasks},(a,i)=>{return i}))
    let keys = new Map()
    const states = configMap
    const inputs = states.filter((x)=>{return !!x[1].input})
    states.sort((a,b)=>(b[1].input || 0)-(a[1].input || 0))
    let statei = 0
    for (const [key,config] of inputs) {
        let {test,pack} = config
        let k = new State(key,pack,test,true)
        keys.set(k.key,k)
    }
    for (const [key,config] of states) {
        if(!config.args)continue
        let {pack,args,setter,isAsync} = config
        if(!(setter instanceof Function))throw new Error('Must provide a function to derive state with')
        if(!Array.isArray(args))throw new Error('Must provide an array of key names to use as arguments for your setter function')
        let stateObj = keys.get(key)
        if(!stateObj){
            stateObj = new State(key,pack,false,false,setter,isAsync)
            keys.set(stateObj.key,stateObj)
        }else{//only for equivalent keys, setting one will convert to other and vice-versa
            stateObj.setter = setter
            stateObj.async = isAsync
        }
        for (const dependentOnKey of args) {
            let prev = keys.get(dependentOnKey)
            if(!prev)throw new Error('Must specify derived keys using only input or derived keys already specified!')
            stateObj.addPrev(prev)
        }
    }
    let orderMap = [...keys].sort((a,b)=>{//set order so dependency changes will resolve in one loop
        let aInput = !!a.input
        let bInput = !!b.input
        if(aInput !== bInput)return aInput-bInput
        return a.depth - b.depth
    })
    keys = new Map(orderMap)
    function State(key,pack,test,isInput,setter,setterIsAsync){
        const s = this
        s.key = key
        s.mByte = Math.floor(statei/8)
        s.mBit = Math.pow(2,7-(statei%8))
        statei++
        if(pack && typeof pack === 'number'){
            if(!packOrder.has(pack))throw new Error('Cannot specify the same order value for more than one key')
            packOrder.delete(pack)
        }else if(pack){
            let a = [...packOrder]
            pack = a.shift()
            if(typeof pack !== 'number')throw new Error('Invalid order assignment')
            packOrder = new Set(a)
        }
        s.pByte = pack?Math.floor(pack/8):false
        s.pBit = pack?Math.pow(2,7-(pack%8)):false
        s.prevMask = Array(stateMasks).fill(0)//mask value of all keys needed to derive s key
        s.test = test instanceof Function ? test : false
        s.requires = []
        s.input = !!isInput
        s.setter = setter instanceof Function ? setter : false
        s.async = !!setterIsAsync
        s.adjacent = []
        s.depth = 0
        s.addPrev = function(stateObj){
            s.requires.push(stateObj)
            s.prevMask[stateObj.mByte] |= stateObj.mBit
            s.depth = Math.max(...s.requires.map((x)=>x.depth))+1
        }        
    }
    Proto = (Proto instanceof Function) ? Proto : function(){}//throw error? No, for if you are building a fully stateful obj
    Proto.prototype.pack = function(arrayOfKeys){
        arrayOfKeys = arrayOfKeys?arrayOfKeys.map((x)=>{return keys.get(x)}) : [...keys.values()]
        const packed = Array(packMasks).fill(0)
        for (const {key,pByte,pBit} of arrayOfKeys) {
            if(this[key] !== undefined && pBit){
                packed[pByte] |= pBit
                packed.push(this[key])
            }
        }
        return packed
    }
    Proto.prototype.getPackMap = function(arrayOfKeys){
        arrayOfKeys = arrayOfKeys?arrayOfKeys.map((x)=>{return keys.get(x)}) : [...keys.values()]
        const packed = Array(packMasks).fill(0)
        for (const {pByte,pBit} of arrayOfKeys) {
            if(pBit){
                packed[pByte] |= pBit
            }
        }
        return packed
    }
    Proto.prototype.unpack = function(input){
        if(!Array.isArray(input))throw new Error('Invalid Input')
        let i = packMasks
        const arrayOfKeys = [...keys.values()]
        const inputs = new Map()
        for (const {key,pByte,pBit,test} of arrayOfKeys) {
            if(input[pByte] & pBit){
                if(test && test instanceof Function)test(input[i])
                inputs.set(key,input[i])
                i++
            }
        }
        this.setKeys(inputs)
    }
    return function(){//object factory
        const values = {}//only this fn can alter
        let state = Array(stateMasks).fill(0)//only this fn can alter
        let processing = false
        let pending = []
        const event = new EventEmitter()
        let o = new Proto(...arguments)
        o.setKeys = setKeys
        o.clearKeys = clearKeys
        o.hasState = hasState
        o.on = event.on
        o.once = event.once
        for (const key of keys.keys()) {
            Object.defineProperty(o,key,{
                enumerable:true,
                get(){return values[key]},
                set(val){setKeys([[key,val]])}
            })
        }
        Object.defineProperty(o,'state',{
            get(){return state},
        })
        return o

        async function setKeys(map){
            //how to make sure things get put in a callstack if it is inprocess, and then call all awaits as done once the state has settled?
            if(!Array.isArray(map)){
                if(map.entries instanceof Function)map = [...map.entries()]
                else map = Object.entries(map) 
            }else if(!map.every((x)=>{return Array.isArray(x)}))throw new Error('Must provide a map array [[key,value],...]')
            let changes = Array(stateMasks).fill(0)
            let keysAltered = []
            for (let [k,v] of map) {
                let key = checkInput(k,v)
                if(!key)continue
                state[key.mByte] |= key.mBit
                values[key.key] = v
                changes[key.mByte] |= key.mBit
                keysAltered.push(key)
            }
            if(!changes)return o
            return await calc(changes,keysAltered)
        }
        async function clearKeys(arr){
            if(!Array.isArray(arr))throw new Error('Must provide an array [key,...]')
            let changes = Array(stateMasks).fill(0)
            let keysAltered = []
            for (let k of arr) {
                let key = keys.get(k)
                if(values[k] === undefined)continue
                state[key.mByte] ^= key.mBit
                values[k] = undefined
                changes[key.mByte] |= key.mBit
                keysAltered.push(key)
            }
            if(!changes)return o
            return await calc(changes,keysAltered,clear)
    
        }
        function hasState(arr,mask){
            if((!arr && !mask) || !Array.isArray(arr))throw new Error('Must provide an array [key,...]')
            if(mask && (!Array.isArray(arr) || !mask.every((x)=>typeof x === 'number')))throw new Error('Must provide a number that represents the keys you are looking for')
            if(mask){
                for (let i = 0; i < mask.length; i++) {
                    const maskByte = mask[i];
                    if(state[i] !== (maskByte | state[i]))return false
                }
                return true
            }
            for (let k of arr) {
                let key = keys.get(k)
                if(!key){ //invalid things will not throw error?
                    throw new Error('Specified key is not stateful!')
                }
                if(!(state & key.mask))return false
            }
            return true
        }
        function checkInput(k,v){
            if(v === undefined)throw new Error('Must provide a value to set. To clear a state, use .clearKeys([key,...])')
            let key = keys.get(k)
            if(!key || !key.input)throw new Error('Invalid Key')
            if(v === values[k])return false //no change
            if(key.test)key.test(v)
            return key
        }
        async function calc(){
            let thisCall = Symbol()
            pending.push([thisCall,[...arguments]])
            if(!processing){
                return await changeState([thisCall],...arguments)
            }
            return new Promise(resolve => {
                event.once(thisCall,resp=>resolve(resp))//resp should be o
            })
            //https://stackoverflow.com/questions/37104199/how-to-await-for-a-callback-to-return
        }
        async function changeState(fulfill,changeMask,keysAltered,clear){
            processing = true
            for (const keyObj of keys.values()) {
                const {depth,mByte,mBit,prevMask,async,setter,key} = keyObj
                if(depth === 0)continue//input key
                if(!(changeMask[mByte] & prevMask[mByte]))continue//dependencies of this key were not altered
                if(prevMask[mByte] !== (state[mByte] & prevMask[mByte]))continue//
                if(clear){
                    values[key] = undefined
                    changeMask[mByte] |= mBit
                    state[mByte] ^= mBit
                    keysAltered.push(keyObj)
                    continue
                }
                let curVal = values[key],newVal
                let args = keyObj.requires.map((x)=>{return values[x.key]})
                if(async){
                    newVal = await setter(...args)
                }else{
                    newVal = setter(...args)
                }
                if(newVal === curVal)continue //the input change did not effect the output
                values[key] = newVal
                changeMask[mByte] |= mBit
                state[mByte] |= mBit
                keysAltered.push(keyObj)
            }
            if(pending.length){
                let [symbol,argArr] = pending.shift()
                fulfill.push(symbol)
                changeState(fulfill,...argArr)
                return
            }
            processing = false
            for (const key of keysAltered) {
                event.emit(key.key,values[key.key])
                //event.emit(key.mask,key.value)
            }
            event.emit('stateChange',state,keysAltered.map((x)=>x.key),keysAltered.map((x)=>x.mask))
            for (const symbol of fulfill) {
                event.emit(symbol,o)
            }
        }
    }
}
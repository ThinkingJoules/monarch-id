import { toMap } from "../util"
import { SHAPEID, SHAPECHAIN, IMPURE, IDS } from "./constants"
import EventEmitter from "eventemitter3"
import MBuffer from "../impl/mbuffer"
import { TypeDef } from "./typedef"
import { parseReqText, evalReqs } from "./logic"


const SHAPEKEYS = Symbol('Keys')
const SHAPEREQS = Symbol('Requirements')//AND/OR array of... key masks or just the key string?
const SHAPEREQPF = Symbol('LogicPostFix')
const SHAPEREQMET = Symbol('HasReqKeys')
const SETTEST = Symbol.for('Shape.setTest')
const SETKEYS = Symbol.for('Shape.setKeys')
const PACK = Symbol.for('Shape.pack')
const UNPACK = Symbol.for('Shape.unpack')
const GETMASK = Symbol.for('Shape.getMask')
const EVENTS = Symbol.for('Shape.events')

export const Shapes = new Map()


const SHAPESHAPE = IDS.shapeShape

export function ShapeGen(ID,shapePayload,{classEmitter=false,instanceEmitter=false,setterChecks}){
    if(!ID.STMTID)throw new Error('Must specifiy STMTID that authored this shape.')
    if(shapePayload[SHAPEID] !== SHAPESHAPE)throw new Error('Must specifiy "Shape" Shape.')
    const extend = shapePayload.extends
    const reqs = shapePayload.keyReqs
    const strict = shapePayload.strictReq
    const configMap = toMap(shapePayload.keys)
    const defVals = toMap(shapePayload.defVals || {})
    let temp
    if((temp=Shapes.get(ID)))return temp
    if(extend && !extend[SHAPEID])throw new Error('Can only extend already generated "Shape"s')
    const Shape = function (packedArr){
        Object.defineProperties(this,{
            [SHAPEKEYS]:{//copy keys locally so we can add state to them for this instance
                //we need to know the packing state of the keys (do we need to iterate/recur to pack, or skip)
                value:copyKeys(this[SHAPEKEYS])
            },
            [SHAPEREQMET]:{
                get() {
                    if(this[SHAPEREQPF] && this[SHAPEREQPF].length){
                        return evalReqs(this[SHAPEREQPF],this)
                    }
                    return true
                }
            }
        })
        if(instanceEmitter){
            Object.defineProperty(this,EVENTS,{
                value:new EventEmitter()
            })
        }
        for (const {sym} of this[SHAPEKEYS].values()) {//set keys as not enumerable
            Object.defineProperty(this,sym,{
                writable:true
            })
        }
        if(Array.isArray(packedArr) && typeof packedArr[0] === 'number'){//hopefully a valid pack array
            this[UNPACK](packedArr)
        }
        if(classEmitter)Shape.events.emit('created',this)
    }
    if(classEmitter)Shape.events = new EventEmitter
    Shape.prototype[SHAPEID] = ID //set the ID should be Shape{mid,ts,id}
    Shape.prototype[SHAPECHAIN] = extend?[...extend.prototype[SHAPECHAIN],ID]:[ID]
    const keys = Shape.prototype[SHAPEKEYS] = extend?copyKeys(extend.prototype[SHAPEKEYS]):new Map()
    //^^Copy prototype keys to new Map on extended prototype, we will add to these
    Shape.prototype[SHAPEREQS] = extend?extend.prototype[SHAPEREQS]:''
    if(reqs)Shape.prototype[SHAPEREQS] = Shape.prototype[SHAPEREQS] ? Shape.prototype[SHAPEREQS] += ' & '+reqs : reqs
    //^^Add additional &  to key reqs

    //what about updating keys?
    //should be allowed on an extend
    //just means that it cannot be 'merged' with old Shapes, so it is not backwards compatible.
    let overlap = []
    if(keys.size){
        let curKeys = [...keys.keys()]
        overlap = [...configMap.keys()].filter((x)=>{return curKeys.includes(x)})
        if(overlap.length){
            configMap = new Map([...configMap].sort((a,b)=>{
                //we don't want to change the order of non-overlap keys
                //but we want to put overlap keys before all of them, and in their correct order
                let ai = overlap.indexOf(a)
                let bi = overlap.indexOf(b)
                if(ai === -1 && bi === -1)return 0
                else if(ai !== -1)return -1
                else if(bi !== -1)return 1})
            )
            Shape.prototype[IMPURE] = true //one or more keys have been altered since the root Shape
        }
    }
    

    let stateMasks = Math.ceil((keys.size+configMap.size-overlap.length)/32)
    let i = overlap.length * -1 // start index negative to account for overlap keys
    for (const [key,type] of configMap) {
        //type is a pimitive value type (anyone of PRIM_ENUM)
        //types is optional and only required if your primitive is {array,enum,tuple}
        if(!TypeDef.isTypeDef(type)){//was not created from the Type interface
            //this works because typedef.js and Type(Shape), produce the same js struct
            throw new Error('Must supply a valid TypeDef Shape.')
        }
        let subPack = TypeDef.extractShapes(type)
        if(i<0){
            let oldKey = keys.get(key)
            oldKey.type = type
            i++
            continue
        }
        let mByte = Math.floor(i/32)
        let mBit = Math.pow(2,(i%32))
        const sym = Symbol(key)
        i++
        let defVal = Object.freeze(defVals.get(key))//just in case??
        if(defVal !== undefined){
            if(!TypeDef.test(type,defVal))throw new Error('default values must conform to the TypeDef')
        }
        keys.set(key,{key,sym,type,mByte,mBit,defVal,subPack,needsSubPack:false})

        Object.defineProperties(Shape.prototype, {
            [key]: {
                enumerable:true,
                configurable:false,
                get() {
                    return this[sym]
                },
                set(x) {
                    this[SETKEYS]([[key,x]])
                }
            },
            [sym]:{
                configurable:true,
                value: defVal
            }
        });
    }
    if(Shape.prototype[SHAPEREQS].length)Shape.prototype[SHAPEREQPF] = parseReqText(Shape.prototype[SHAPEREQS],[...keys.keys()])
    Shapes.set(ID,Shape)
    if(extend)return Shape //??

    Shape.prototype[SETKEYS] = function setKeys(map){//fail silent? so it will continue setting keys on what it can?
        map = toMap(map)
        let toSet = {}
        let hasreq = this[SHAPEREQMET] === true
        for (let [k,v] of map) {
            let key = keys.get(k)
            if(!key)throw new Error('Invalid Key')
            if(v === this[key.sym])return false //no change
            if(v !== undefined){
                if(TypeDef.test(key.type,v)){
                    //passed the shape test
                    let classTest = setterChecks[key.key]
                    if(classTest instanceof Function)classTest.call(classTest,v)//should throw if invalid,internal only
                    let localTest = (this[SETTEST] || {})[key.key]
                    if(localTest instanceof Function)localTest.call(localTest,v)//should throw if invalid
                    if(key.subPack.length && key.needsSubPack === !v[SHAPEID])key.needsSubPack = !key.needsSubPack
                }else{
                    throw new Error('Invalid value given for key: '+k)
                }
            }else{
                key.needsSubPack = false
            }
            if(Array.isArray(v))Object.freeze(v)
            toSet[key.sym] = v
        }
        if(strict && hasreq && this[SHAPEREQS].length){
            let preTest = Object.assign({},this,toSet)
            if(!evalReqs(this[SHAPEREQPF],preTest)){
                throw new Error('Shape is set to "strict" which mean once it has the keys required, all key changes must keep the requirement satified.')
            }
        }
        Object.assign(this,toSet)
        for (const k of map.keys()) {
            this[EVENTS].emit(k,this[k])
        }
        return this
    }
    
    Shape.prototype[PACK] = function pack(arrayOfKeys){
        if(arrayOfKeys){
            arrayOfKeys.map((x)=>{
                let key
                if(!(key = keys.get(x)))throw new Error('Invalid key given')//or just skip key??
                return key
            })
        }else{
            arrayOfKeys = [...keys.values()]
        }
        const packed = Array(stateMasks).fill(0)
        for (const {key,sym,mByte,mBit,needsSubPack} of arrayOfKeys) {
            if(this[key] !== undefined && mBit){
                let value = this[sym]
                if(needsSubPack){
                    value = findShapes(value)
                }
                packed[mByte] |= mBit
                packed.push(value)
            }
        }
        for (let i = 0; i < stateMasks; i++) {
            packed[i] = packed[i]>>>0//get mask to uint
            
        }
        return packed
        function findShapes(value){
            if(Array.isArray(value)){
                for (const val of value) {
                    value[i] = findShapes(val)
                }
                return value
            }else{
                if(value[SHAPEID])return value[PACK]()
                else return value
            }
        }
    }
    Shape.prototype[GETMASK] = function getMask(arrayOfKeys){
        if(arrayOfKeys){
            arrayOfKeys.map((x)=>{
                let key
                if(!(key = keys.get(x)))throw new Error('Invalid key given')//or just skip key??
                return key
            })
        }else{
            arrayOfKeys = [...keys.values()]
        }
        const packed = Array(stateMasks).fill(0)
        for (const {mByte,mBit} of arrayOfKeys) {
            packed[mByte] |= mBit
        }
        return packed
    }
    Shape.prototype[UNPACK] = function unpack(input){
        if(!Array.isArray(input))throw new Error('Invalid Input')
        if(input.shape)return input.shape
        let i = stateMasks
        const arrayOfKeys = [...keys.values()]
        const inputs = new Map()
        //need to run recursively...
        for (const {key,mByte,mBit,subPack} of arrayOfKeys) {
            if(input[mByte] & mBit){
                let value
                if(subPack.length){
                    for (const shapeid of subPack) {
                        if(shapeid === TYPESHAPE)continue//leave in typeDef form
                        try {
                            let shape = Shapes.get(MBuffer('STMTID',shapeid))
                            value = new shape(input[i])
                        } catch (e) {continue}
                        break
                    }
                }
                value = value || input[i]
                inputs.set(key,value)
                i++
            }
        }
        return this[SETKEYS](inputs)
    }
    return Shape 
}


function copyKeys(keyMap){
    const newMap = new Map()
    for (const [key,keyObj] of keyMap) {
        newMap.set(key,{...keyObj})
    }
    return newMap
}



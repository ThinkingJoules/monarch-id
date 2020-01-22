import { uintToBuff, Enum } from "../util"
import { PID, SHAPEID, IDS } from "./constants"
import MBuffer from "../impl/mbuffer"

function makeID(num){
    return MBuffer('STMTID',[PID,uintToBuff(num,6)])
}
const shapeMask = {
    'null':1,
    'boolean':2,
    'number':4,
    'string':8,
    'binary':16,
    'shape':32,
    'enum':64,
    'array':128,
    'tuple':256,
    'ANY':512
}
export const MASKS_ENUM = new Enum(shapeMask)

const ids = {
    'null':makeID(0),
    'boolean':makeID(1),
    'number':makeID(2),
    'string':makeID(3),
    'binary':makeID(4),
    'shape':makeID(5),
    'enum':makeID(6),
    'array':makeID(7),
    'tuple':makeID(8),
    'ANY':makeID(9)
}
const TYPESHAPEID = IDS.typeShape
const noConfig = (shapeMask.null|shapeMask.boolean|shapeMask.ANY)
const valid = Object.values(ids)

export class TypeDef extends Array {
    constructor(type,def){
        super()
        let mask,td
        if(type[SHAPEID] && valid.includes(type[SHAPEID]))return type
        if(type[SHAPEID] === TYPESHAPEID)return new TypeDef(type[Symbol.for('Shape.pack')])
        if(Array.isArray(type) && Array.isArray(type[0])){
            //recursively build types on arrays that do not have a SHAPEID
            for (let i = 0; i < type.length; i++) {
                const types = type[i];
                type[i] = new TypeDef(types)
            }
            return type
        }else if(Array.isArray(type) && typeof type[0] === 'number' && MASKS_ENUM[type[0]] !== undefined){
            td = type
            mask = type[0]
            def = type[1]
            type = MASKS_ENUM[mask]
        }else if(typeof type === 'string'){
            mask = MASKS_ENUM[type]
        }else if(typeof type  === 'number'){
            mask = type
            type = MASKS_ENUM[type]
        }else if(Array.isArray(type) && !(typeof type[0] === 'number' && MASKS_ENUM[type[0]] !== undefined)){
            throw new Error('Cannot parse Array in to a TypeDef')
        }else{
            throw new Error('Invalid first argument given for new TypeDef')
        }

        td = td || this //change existing array if we can
        if(!mask)throw new Error('Invalid tag given')
        td[0] = td[0] || mask
        if(noConfig&mask){
            td[1] = null
            if(td.length > 2)throw new Error('Expecting no more than two elements, instead found length of: '+td.length)
        }else{
            switch (mask) {
                case 4:
                case 8:
                case 16:{
                    if(typeof def === 'number')def = [0,def]//max length
                    if(!((Array.isArray(def) && def.every((x)=>{return typeof x === 'number'}) && def.length === 2) || [null,undefined,false].includes(def))){
                        throw new Error('Must provide a [number,number] tuple representing [min,max] (inclusive) length/value.')
                    }
                    def = def || [0,0]
                    break
                }
                case 32:{
                    if(!(def instanceof Uint8Array && def.length === 24)){
                        throw new Error('Must specify a 24 byte binary STMTID.')
                    }
                    break
                }
                case 64:{
                    if(!(Array.isArray(def) && def.every((x)=>{return typeof x === 'string'}))){
                        throw new Error('Must provide an array of strings for "enum"')
                    }
                    break
                }
                case 128:{
                    if(!Array.isArray(def)){
                        throw new Error('Must provide an tuple of [Array[TypeDefs],number,number]')
                    }
                    if(!(Array.isArray(def[0]) && typeof def[1] === 'number' && typeof def[2] === 'number')){
                        throw new Error('Must provide an tuple of [Array[TypeDefs],number,number]')
                    }
                    for (let i = 0; i < def[0].length; i++) {
                        const el = def[0][i];
                        def[0][i] = new TypeDef(el)
                    }
                    break
                }
                case 256:{
                    if(!Array.isArray(def)){
                        throw new Error('Must provide an array of TypeDefs')
                    }
                    for (let i = 0; i < def.length; i++) {
                        const el = def[i];
                        def[i] = new TypeDef(el)
                    }
                    break
                }
                default:throw new Error('Invalid Type Mask')
            }
            if(td.length > 2)throw new Error('Invalid length, expecting length of 2 was: '+td.length)
            td[1] = def
        }
        Object.defineProperty(td,SHAPEID,{value:ids[type]})
        Object.freeze(td)
        return td
    }
    static isTypeDef(arr){
        try {
            new TypeDef(arr)
            return true
        } catch (error) {
            return false
        }
    }
    static extractShapes(arr){
        let things = []
        arr = new TypeDef(arr)
        if(arr[SHAPEID] === ids.shape){
            if(Array.isArray(arr[1])){
                for (const stmtid of arr[1]) {
                    add(stmtid)
                }
            }else{
                add(arr[1])
            }
            return things
        }else if([ids.array,ids.tuple].includes(arr[SHAPEID])){
            if(!arr[1][SHAPEID]){
                add(TypeDef.extractShapes(arr[1]))
            }
        }else if(!arr[SHAPEID] && Array.isArray(arr)){
            for (const td of arr) {
                add(TypeDef.extractShapes(td))
            }
        }
        return things
        function add(stmtid){
            if(Array.isArray(stmtid)){
                for (const thing of stmtid) {
                    let sb = MBuffer('STMTID',thing)
                    if(!things.includes(sb))things.push(sb)
                }
            }else{
                let sb = MBuffer('STMTID',stmtid)
                if(!things.includes(sb))things.push(sb)
            }
        }
    }
    static test(td,val){
        td = new TypeDef(td)//make sure it is valid
        return testTypeDef(td,val)
        function testTypeDef(td,value){
            let mask,tagParams
            if(Array.isArray(td) && Array.isArray(td[0])){//or block
                let passing = false
                for (const el of td) {
                    if(passing)return true
                    passing = testTypeDef(el,value,arrOr)
                }
                return passing
            }else if(Array.isArray(td) && typeof td[0] === 'number' && td[SHAPEID]){
                mask = td[0]
                tagParams = td[1]
            }
            switch (mask) {//FIGURE OUT HOW TO PROPAGATE AN ERROR
                case 512:return true
                case 1:return (value===null)
                case 2:{return (typeof value === MASKS_ENUM[mask])}
                case 4:{
                    if(!typeof value === MASKS_ENUM[mask]){
                        //throw new Error('Must provide a number!')
                        return false
                    }
                    if(tagParams[0] === 0 && tagParams[1] === 0)return true //this is the 'ANY NUMBER' config
                    //if either one are non-zero, they are evaluated per the parameters
                    if((value < tagParams[0]) || (value > tagParams[1])){
                        //throw new Error('value is outside min or max')
                        return false
                    }
                    return true
                }
                case 8:{
                    if(!typeof value === MASKS_ENUM[mask]){
                        //throw new Error('Must provide a string!')
                        return false
                    }
                    if(tagParams[0] === 0 && tagParams[1] === 0)return true //this is the 'NO LIMITS' config

                    if((tagParams[0] && value.length <= tagParams[0]) || (tagParams[1] && value.length >= tagParams[1])){
                        //throw new Error('length is outside min or max')
                        return false
                    }
                    return true
                }
                case 16:{
                    if(!(value instanceof Uint8Array)){
                        //throw new Error('Must provide a binary array!')
                        return false
                    }
                    if(tagParams[0] === 0 && tagParams[1] === 0)return true //this is the 'NO LIMITS' config

                    if((tagParams[0] && value.length <= tagParams[0]) || (tagParams[1] && value.length >= tagParams[1])){
                        //throw new Error('length is outside min or max')
                        return false
                    }
                    return true
                }
                case 32:{
                    if(!value[SHAPEID])return false
                    return value[SHAPEID] === MBuffer('STMTID',tagParams)
                }
                case 64:{
                    if(typeof value !== 'string'){
                        return false
                    }
                    return tagParams.includes(value)
                }
                case 128:{
                    if(!Array.isArray(value))return false
                    if(tagParams[1] === -1 && tagParams[2] === 0 && value.length){
                        //throw new Error('Array is not allowed to be used. You cannot have any values in it.')
                        return false
                    }
                    if(!(tagParams[1] === 0 && tagParams[1] === 0) && (tagParams[1] >= value.length || tagParams[2] <= value.length)){
                        //outside the min/max
                        return false
                    }
                    for (const el of value) {
                        if(!testTypeDef(tagParams[0],el))return false
                    }
                    return true
                }
                case 256:{
                    if(!Array.isArray(value))return false
                    if(tagParams.length !== value.length)return false
                    let i = 0
                    for (const el of tagParams) {
                        let is = value[i]
                        if(!testTypeDef(el,is))return false
                        i++
                    }
                    return true
                }
                
                default:{
                    throw new Error('Invalid type tag given')
                }
            }
        }
    }
}


import { Enum } from "./util"

const TYPE_MASKS = new Map([
    ['selection',1],
    ['boolean',2],
    ['number',4],
    ['string',8],
    ['value',16],
    ['binary',32],
    ['enum',64],
    ['array',128],
    ['tuple',256],
    ['shape',512],
    ['ANY',1024],
    ['null',2048],

])

const MASKS_ENUM = new Enum(TYPE_MASKS)

const noConfig = (2|4|8|1024|2048)
export function Type(tag,val){
    if(new.target)return Type(tag,val)
    if(Array.isArray(tag))return Type.OR(tag)
    const prim = []
    if(typeof tag !== 'string')throw new Error('Must provide a string tag')
    prim[0] = 0
    applyMask(prim,tag,val)
    prim.Type = true
    return prim
}
function validateTypeDef(TypeDef,arrOr){
    if(Array.isArray(TypeDef[0])){
        for (const el of TypeDef) {
            if(typeof el === 'number' && arrOr)continue
            validateTypeDef(el)
        }
        return
    }else if(typeof TypeDef[0] === 'number' && (MASKS_ENUM.selection & TypeDef[0])){
        let i = 1
        for (const mask of TYPE_MASKS.values()) {
            if(mask === 1){continue}//ignore 'selection' mask
            if(TypeDef[0] & mask){
                validateTypeDef([mask,TypeDef[i]])
                if(!(noConfig&mask)){
                    i++
                }
            }
        }
        return
    }
    let mask = TypeDef[0]
    let config = TypeDef[1]
    switch (mask) {
        case 2:
        case 4:
        case 1024:
        case 2048:
        case 8:{
            push=false;
            break;
        }
        case 16:{
            if(!(['string','number','boolean'].includes(typeof config) || config instanceof Uint8Array)){
                throw new Error('Must provide a primitive value for "value". "string,number,boolean,binary"')
            }
            break;
        }
        case 32:{
            if(!(typeof config === 'number' || [null,undefined,false].includes(config))){
                throw new Error('Must provide a number representing the fixed length of the byteArray.')
            }
            break;
        }
        case 64:{
            if(!(Array.isArray(config) && config.every((x)=>{return typeof x === 'string'}))){
                throw new Error('Must provide an array of strings for "enum"')
            }
            break;
        }
        case 128:{
            if(!Array.isArray(config)){
                throw new Error('Must provide an array of OR arrays or Prim arrays')
            }
            // for (let i = 0; i < config.length; i++) {
            //     const el = config[i];
            //     if(Array.isArray(el))continue
            //     if(i === config.length-1 && typeof el === 'number')continue
            //     throw new Error('Must specify an array. Each element must be a Type Def or an array of Type Defs (OR). To specify a max length, the last element can be a number')
            // }
            // checkArrConfig(config)
            validateTypeDef(config,true)//should be an array of TypeDefs
            break;
        }
        case 256:{
            if(!(Array.isArray(config) && config.every((x)=>{return Array.isArray(x)}))){
                throw new Error('Each element must be a Type Def or an array of Type Defs (OR)')
            }
            validateTypeDef(config)//should be an array of TypeDefs
            break;
        }
        case 512:{
            if(!(config instanceof Uint8Array && config.length === 24)){
                throw new Error('Must specify a 24 byte binary STMTID.')
            }
            break;
        }
        default:{
            throw new Error('Invalid type tag given')
        }
    }
}

function applyMask(Type,tag,config){
    let mask = MASKS_ENUM[tag]
    validateTypeDef([mask,config])//should throw if invalid
    if(!(noConfig & mask))Type.push((mask === 32)?config||0:config)
    Type[0] |= mask
    return true
    
}

Type.OR = function or(arr){
    let types = new Set()
    try {
        for (const Type of arr) {
            validateTypeDef(MASKS_ENUM[Type[0]],Type[1])
            types.add(Type[0])
        }
        if(types.size === arr.length){
            return Type.XOR(arr)
        }
    } catch (error) {
        throw new Error('Invalid OR Type construction', error)
    }
    return arr
}
Type.XOR = function selection(arr){
    const prim = []
    if(!(Array.isArray(arr) && arr.every(Array.isArray)))throw new Error('Must provide an arry of TypeDefs (array)')
    if((new Set(arr.map((x)=>{return x[0]}))).size !== arr.length)throw new Error('Must provide Types that do not conflict')
    prim[0] |= 1

    for (const type of arr) {
        applyMask(prim,MASKS_ENUM[type[0]],type[1])
    }
    return prim
}
Type.test = function test(TypeDef,value) {
    return testTypeDef(TypeDef,value)
}
function testTypeDef(TypeDef,value,arrOr){
    if(Array.isArray(TypeDef[0])){
        //or array
        let passing = false
        for (const el of TypeDef) {
            if(passing)return true
            if(typeof el === 'number' && arrOr)continue

            passing = testTypeDef(el,value,arrOr)
        }
        return passing
    }else if(typeof TypeDef[0] === 'number' && (MASKS_ENUM.selection & TypeDef[0])){
        let i = 1
        let passing = false
        for (const mask of TYPE_MASKS.values()) {
            if(mask === 1){continue}//ignore 'selection' mask
            if(TypeDef[0] & mask){
                if(passing)return true
                passing = testTypeDef([mask,TypeDef[i]],value,arrOr)
                if(!(noConfig&mask)){
                    i++
                }
            }
        }
        return passing
    }
    let mask = TypeDef[0]
    let tagParams = TypeDef[1]
    switch (mask) {
        case 1024:return true
        case 2048:return (value===null)
        case 2:
        case 4:
        case 8:{return (typeof value === MASKS_ENUM[mask])}
        case 16:{//not sure if we need to have 'value'
            return value === tagParams
        }
        case 32:{
            if(!(value instanceof Uint8Array)){
                //throw new Error('Must provide a binary array!')
                return false
            }
            if(tagParams && value.length !== tagParams){
                //throw new Error('Incorrect byte length received!')
                return false
            }
            return true
        }
        case 64:{
            if(typeof value !== 'string'){
                return false
            }
            return tagParams.includes(value)
        }
        case 128:{
            if(!Array.isArray(value))return false
            if(typeof tagParams[tagParams.length-1] === 'number' && value.length > tagParams[tagParams.length-1]){
                return false
            }
            let passing = true
            for (const el of value) {
                if(!passing)return passing
                passing = testTypeDef(tagParams,el,true)
            }
            return passing
        }
        case 256:{
            if(!Array.isArray(value))return false
            if(tagParams.length !== value.length)return false
            let i = 0
            for (const el of tagParams) {
                let is = value[i]
                if(!Prim.test(el,is))return false
                i++
            }
            return true
        }
        case 512:{
            if(!value[SHAPEID])return false
            return value[SHAPEID].equals(Buffer.from(tagParams))
        }
        
        default:{
            throw new Error('Invalid type tag given')
        }
    }
}
Type.isTypeDef = function(TypeDef){
    try {
        validateTypeDef(TypeDef)
        return true
    } catch (error) {
        return false
    }
}
Type.extractShapes = function(TypeDef){
    return extract(TypeDef,'shape')
}
function extract(TypeDef,getMask){
    let things = []
    try {
        getMask = (typeof getMask === 'number' && MASKS_ENUM[getMask] !== undefined) ? getMask : MASKS_ENUM[getMask]
        if(Array.isArray(TypeDef[0])){//OR array
            for (const el of TypeDef) {
                grab(extractor(el,getMask))
            }
        }else grab(extractor(TypeDef,getMask))
        return things
    } catch (error) {
        return false
    }
    function grab(found){
        if(found){
            if(Array.isArray(found))things = [...things,...found]
            else things.push(found)
        }
    }
}
function extractor(primArr,extractMask){
    let bm = primArr[0]
    
    if(bm & MASKS_ENUM.selection){//OR types, within primArr
        let i = 0
        for (const mask of TYPE_MASKS.values()) {
            if(mask === 1){i++;continue}//ignore 'selection' mask
            if(bm & mask){
                if(bm&extractMask){//extractor can only grab one type
                   return primArr[i]
                }
                if(!(noConfig&mask)){
                    i++
                }
            }
        }
        return false
    }else if(bm&extractMask){
        return primArr[1]
    }else{
        if(Array.isArray(primArr[1])){
            return extract(primArr[1],extractMask)
        }
    }
}



//no longer
function checkArrConfig(arr){
    if(isOr(arr)){
        for (const el of arr) {
            checkPrim(el)
        }
    }else{
        checkPrim(arr)
    } 
}
function isOr(arr){
    if(Array.isArray(arr[0]))return true
    if(typeof arr[0] === 'number' && MASKS_ENUM[arr[0]] !== undefined){
        return false
    }
    if(typeof arr[0] === 'number' && MASKS_ENUM.selection & arr[0]){
        let i = 1
        for (const mask of TYPE_MASKS.values()) {
            if(mask === 1){continue}//ignore 'selection' mask
            if(arr[0] & mask && !(noConfig&mask)){
                i++
            }
        }
        return (arr.length === i)
    }
    return false//should be an error?
}
function checkPrim(primArr){
    if(typeof primArr[0] === 'number' && !(primArr[0] & MASKS_ENUM.selection) && MASKS_ENUM[primArr[0]] !== undefined){
        if((primArr[0] & noConfig) && primArr.length == 1)return true
        if(primArr.length == 2)return true
        return false
    }
    if(typeof primArr[0] === 'number' && (MASKS_ENUM.selection & primArr[0])){
        let i = 1
        for (const mask of TYPE_MASKS.values()) {
            if(mask === 1){continue}//ignore 'selection' mask
            if(primArr[0] & mask && !(noConfig&mask)){
                i++
            }
        }
        if(primArr.length === i)return true
    }
    if(typeof primArr === 'number')return true //max arr length, this would be caught if entered on tuple
    throw new Error('Invalid Primitive array')
}
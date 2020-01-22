import { uintToBuff, Enum } from '../util'
const LENGTHS = {
    //BLOB:Infinity,
    STMTID:24,
    HASH:18,
    MID:18,
    // PUB:65,
    // PROOF:16,
    // SIG:64,
    TS:6,
    // HASHTAG:18,
    // SMETAHASH:18,
    // PMETAHASH:18,
    // PAYLOADHASH:18,
    // TREEHASH:18
}
const BINARYTYPES = {
    //BLOB:4,
    STMTID:12,
    HASH:28,
    MID:50,
    //PUB:60,
    //PROOF:62,
    //SIG:72,
    //SHAPEID:74,//same as 12, just a special prim
    //ROOTHASH:68,
    TS:78,
    //HASHTAG:132,
    //SMETAHASH:152,
    //PMETAHASH:164,
    //PAYLOADHASH:166,
    //TREEHASH:182
}
export const PRIM_BIN_ENUM = new Enum(BINARYTYPES)
const mem = new Map()
export default function MBuffer(type,uint8){//should only be used for ID's or things you want both the string and the buffer often
    if((typeof type === 'number' && !(type=PRIM_BIN_ENUM[type])) || PRIM_BIN_ENUM[type] === undefined)throw new Error('Invalid Monarch Binary Type')
    let buf,temp,binStr
    if(uint8.b64)return uint8
    if(typeof uint8 === 'string'){
        binStr = uint8
        uint8 = Buffer.from(uint8,'base64')
    }
    if(type == 'TS' && typeof uint8 === 'number'){
        if(typeof uint8 === 'number')buf = uintToBuff(uint8,6)
        else if(uint8 instanceof Uint8Array && uint8.length === 6)buf=uint8
        else if(Array.isArray(uint8) && uint8.length === 6)buf=Buffer.from(uint8)
        else throw new Error('Must supply a number or an 6 byte array')
    }else if(type === 'STMTID'){
        if(Array.isArray(uint8))buf = Buffer.concat(uint8)
        else buf = Buffer.from(uint8)
    }else if(uint8 instanceof Uint8Array || Array.isArray(uint8)){
        buf = Buffer.from(uint8)//always copy
    }else throw new Error('Ambiguous input, please provide a base64 string, or Array-like set of bytes')
    if(['HASH','MID'].includes(type) && buf.length > 18){
        buf = buf.slice(0,18)
    }
    binStr = binStr || buf.toString('base64')
    if(['MID','STMTID'].includes(type) && (temp = mem.get(binStr)) !== undefined)return temp
    if(buf.length !== LENGTHS[type])throw new Error('Invalid bytes given for type specified.')
    buf[type] = true
    buf.b64 = binStr
    if(['MID','STMTID'].includes(type)){//only for things that we will use as keys in a map/set
        mem.set(binStr, buf)
    }
    return buf
}
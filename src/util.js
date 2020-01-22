import { decode as dec, encode as enc } from "@msgpack/msgpack";
import EventEmitter from "eventemitter3";

//REGEX STUFF
export const regOr = (regArr) =>{
    let eval2 = eval
    let cur = ''
    for (const r of regArr) {
        cur += '(?:'+r.toString().slice(1,-2)+')' + '|'
    }
    cur = cur.slice(0,-1) //remove trailing '|'
    cur = '/'+cur+'/i'
    return eval2(cur)
}



//getter and setters
export function setValue(propertyPath, value, obj,merge){
    if(!Array.isArray(propertyPath))throw new Error('Must provide an array for propertyPath')
    if (propertyPath.length > 1) {
        if (!obj.hasOwnProperty(propertyPath[0]) || typeof obj[propertyPath[0]] !== "object") obj[propertyPath[0]] = {}
        return setValue(propertyPath.slice(1), value, obj[propertyPath[0]],merge)
    } else {
        if(merge && typeof value == 'object' && value !== null){
            if (!obj.hasOwnProperty(propertyPath[0]) || typeof obj[propertyPath[0]] !== "object") obj[propertyPath[0]] = {}
            for (const key in value) {
                obj[propertyPath[0]][key] = value[key]
            }
        }else{
            obj[propertyPath[0]] = value
        }
        return true // this is the end
    }
}
export function getValue(propertyPath, obj){
    if(typeof obj !== 'object' || Array.isArray(obj) || obj === null)return undefined
    if(!Array.isArray(propertyPath))throw new Error('Must provide an array for propertyPath')
    if (propertyPath.length > 1) {// Not yet at the last property so keep digging
      if (!obj.hasOwnProperty(propertyPath[0])){
          return undefined
      }
      return getValue(propertyPath.slice(1), obj[propertyPath[0]])
    }else{
        return obj[propertyPath[0]]
    }
}
export function mergeObj(oldO,newO){
    //console.log({oldO,newO})
    for (const key in newO) {
        const val = newO[key];
        if(isObj(val,true)){
            if(!isObj(oldO[key]))oldO[key] = {}
            mergeObj(oldO[key],newO[key])
        }
        oldO[key] = newO[key]
    }
}
export function toMap(mapLike){
    if(mapLike instanceof Map)return mapLike
    if(Array.isArray(mapLike) && mapLike.every((x)=>{return Array.isArray(x) && x.length === 2}))return new Map(mapLike)
    if(isObj(mapLike,true))return new Map(Object.entries(mapLike))
    throw new Error('mapLike thing is not mapLike enough to make a Map')
}
export function Enum(obj){
    if(Array.isArray(obj) && obj.every((x)=>{return typeof x === 'string'})){
        for (let i = 0; i < obj.length; i++) {
            const key = obj[i];
            this[this[key]=i] = key   
        }
        return this
    }
    obj = toMap(obj)
    for (const [key,val] of obj) {
        this[this[key]=val] = key
    }
}
export function packify(arrayOfKeys,Proto){
    const maskBytes = Math.ceil(arrayOfKeys.length/8)
    const keyMap = {}
    for (let i = 0; i < arrayOfKeys.length; i++) {
        const [key,test] = arrayOfKeys[i];
        const byte = Math.floor(i/8)
        const bit = Math.pow(2,8-(i%8)-1)
        keyMap[key] = {byte,bit,test}
    }
    Proto.prototype.pack = function(){
        const packed = Array(maskBytes).fill(0)
        for (const key of arrayOfKeys) {
            if(this[key] !== undefined){
                let {byte,bit} = keyMap[key]
                packed[byte] |= bit
                packed.push(this[key])
            }
        }
        return packed
    }
    Proto.prototype.unpack = function(input){
        if(!Array.isArray(input))throw new Error('Invalid Input')
        let i = maskBytes
        for (const key of arrayOfKeys) {
            let {byte,bit} = keyMap[key]
            if(input[byte] & bit){
                if(test && test instanceof Function)test(input[i])
                this[key] = input[i]
                i++
            }
        }
    }
}

export const MemoStore = (function(func,toKey,argChecker,isAsync){
    const cache = new Map()
    if(!(func instanceof Function && toKey instanceof Function && argChecker instanceof Function)){
        throw new Error('Must provide 3 functions to use MemoStore')
    }
    return isAsync ?
    async function(){//key must be string
        argChecker(...arguments)
        const key = toKey(...arguments)
        let val = cache.get(key)
        if(val === undefined){
            val = await func.apply(this, arguments);
            cache.set(key,val)
        }
        return val;
    } :
    function(){//key must be string
        argChecker(...arguments)
        const key = toKey(...arguments)
        let val = cache.get(key)
        if(val === undefined){
            val = func.apply(this, arguments);
            cache.set(key,val)
        }
        return val;
    }
    
 })
//error handling
export function throwError(cb,errmsg){
    let error = (errmsg instanceof Error) ? errmsg : new Error(errmsg)
    console.log(error)
    cb.call(cb,error)
    return error
}




function StringCMD(path,appendApiToEnd){
    let self = this
    this.curCMD = (path) ? 'gbase.base' : 'gbase'
    this.configPath = path && configPathFromChainPath(path) || []
    let cPath = this.configPath
    if(appendApiToEnd)cPath = [...cPath,appendApiToEnd]
    for (let i = 0; i < cPath.length; i++) {
        const get = cPath[i];
        if(i == cPath.length-1 && appendApiToEnd)this.curCMD+='.'+appendApiToEnd
        else if(!(i%2))this.curCMD+=`('`+get+`')`
        else if(i === 1 && get === 'props')this.curCMD+='.nodeType'
        else if(i === 1 && get === 'relations')this.curCMD+='.relation'
        else if(i === 3)this.curCMD+='.prop'
        
    }
    this.appendReturn = function(string,asIs){
        if(asIs)return self.curCMD+string
        return self.curCMD+"('"+string+"')"
    }
}


const ID_SCHEMA = (c) => {
    //case: [sym,idx]
    switch (c) {
        case 0:return ['pid']
        case 2:return ['ts']
        case 4:return ['wants']

        case 24:return ['header']
        case 28: //wkn hash
        case 80:return ['hash'] //unique val hash
        
        case 64:return['b']
        
        case 92://node root, -> Set(Array of Pvals)
        case 93:return ['t','i'];//node nodeUP -> Set(UP NodeIDs)
        case 94://property value -> [VALUE, Number(Altered unix), OPT_Number(Expire Unix), OPT_Array(Binary SIG), OPT_Array(Binary PUB KEY)]
        case 95://property UP refs ->Set(UP Addresses)
        case 96:// Prop List -> Set(Array of Keys in list)
        case 97:return ['t','i','p'];// Prop List Length -> Number()
        case 98:return ['t','i','p','k'];//list value -> [VALUE, Number(Altered unix), OPT_Number(Expire Unix), OPT_Array(Binary SIG), OPT_Array(Binary PUB KEY)]
    
        default:return false;
    }
}

const notFound = String.fromCharCode(21)



function signChallenge(root,peer){
    let challenge = peer.theirChallenge
    root.sign(challenge,function(sig){
        peer.theirChallenge = false
        if(peer.pub)root.on.pairwise(peer)
        let m = root.router.msgs.recv.challenge(challenge,sig)
        console.log(m)
        peer.send(m)
    })
}



export function isObj(val,isLiteral) {
    if (typeof val !== "object" || val === null)
    return false;
    if(!isLiteral)return (typeof val === "object" && !Array.isArray(val) && val !== null);

    var hasOwnProp = Object.prototype.hasOwnProperty,
    ObjProto = val;

    // get obj's Object constructor's prototype
    while (Object.getPrototypeOf(ObjProto = Object.getPrototypeOf(ObjProto)) !== null);

    if (!Object.getPrototypeOf.isNative) // workaround if non-native Object.getPrototypeOf
        for (var prop in val)
            if (!hasOwnProp.call(val, prop) && !hasOwnProp.call(ObjProto, prop)) // inherited elsewhere
                return false;

    return Object.getPrototypeOf(val) === ObjProto;
}
export function encode(val,toStr,sortKeys){
    val = (val instanceof Set || val instanceof Map)?[...val]:val
    let e = enc(val,{sortKeys})
    return toStr?Buffer.from(e.buffer,e.byteOffset,e.byteLength).toString('base64'):Buffer.from(e.buffer,e.byteOffset,e.byteLength)
}
export function decode(binArrOrB64){
    binArrOrB64 = (typeof binArrOrB64 === 'string')?Buffer.from(binArrOrB64,'base64'):binArrOrB64
    let val = dec(binArrOrB64)
    return (val instanceof Uint8Array)?Buffer.from(val.buffer,val.byteOffset,val.byteLength):val
}


export const hammingWt = MemoStore(function(n) {
    n = n - ((n >> 1) & 0x55555555)
    n = (n & 0x33333333) + ((n >> 2) & 0x33333333)
    return ((n + (n >> 4) & 0xF0F0F0F) * 0x1010101) >> 24
    },
    function(n){
        return String(n)
    },
    function(n){
        if(isNaN(n*1))throw new Error('Arg must be a number')
        if(n>Math.pow(2,8*4)-1)throw new Error('Number must be within 32bit range')
    }
)

const mem = new Map()
export function BitID(uint8){//should only be used for ID's or things you want both the string and the buffer often
    let buf,temp,binStr
    const bin = this
    if(uint8 instanceof BitID)return uint8
    else if(uint8 instanceof Buffer || uint8 instanceof Uint8Array || uint8 instanceof ArrayBuffer || Array.isArray(uint8)){
        buf = Buffer.from(uint8)//always copy
    }else if(typeof uint8 === 'string'){
        binStr = uint8
        buf = Buffer.from(uint8,'binary')
    }else throw new Error('Ambiguous input, please provide a string, or Array-like set of bytes')
    bin.string = binStr || buf.toString('binary')
    if((temp = mem.get(binStr)) !== undefined)return temp
    bin.buffer = buf
    mem.set(binStr, bin)
    return bin
}
BitID.dist = function(bin1,bin2){
    if(!(bin1 && bin2)) throw new Error('Must provide 2 Arguments')
    bin1 = BitID(bin1),bin2 = BitID(bin2)
    if(bin1.buffer.length !== bin2.buffer.length)throw new Error('Byte arrays must be the same length')
    let d = 0
    let len = bin1.buffer.length
    for (let i = 0; i < len; i++) {
        d += hammingWt(bin1.buffer[i]^bin2.buffer[i])
    }
    return d
}




export function hammingDist(a,b){
    let d = 0;
    let h = a ^ b;
    while (h > 0) {
        d ++;
        h &= h - 1;
    }
    return d;
}
export function validBytes(compByte,dist){
    if(dist > 8 || dist < 0)throw new Error('dist must be between 0-8')
    if(compByte>255)throw new Error('must provide an unsigned 8 bit number')
    if(dist === 0)return [compByte]
    let total = (factorial(8)/(factorial(dist)*factorial(8-dist)))
    let val = Math.pow(2,dist)-1
    if(dist === 8)return [compByte^val]
    let valid = []
    for (let i = 0; i < total; i++) {
        valid.push(compByte^val)
        //https://math.stackexchange.com/questions/2254151/is-there-a-general-formula-to-generate-all-numbers-with-a-given-binary-hamming
        let c = val & -val;
        let r = val + c;
        val = (((r^val) >> 2) / c) | r;
    }
    return valid;
}
export function factorial(num) {
    var result = num;
    if (num === 0 || num === 1) 
      return 1; 
    while (num > 1) { 
      num--;
      result *= num;
    }
    return result;
}


export function buffUtil (input,opt){
    opt = opt || {}
    let buffer = toBuffer(input,opt.encoding)
    buffer[Symbol.toPrimitive] = function(hint){
        if (hint == 'string') {
            return this.toString('binary');
        }
        return this;
    }
    return buffer
    
}
export function toBuffer(input,encoding){
    encoding = encoding || 'binary'
    if(input instanceof Buffer)return input
    if(input instanceof Uint8Array || input instanceof ArrayBuffer)return Buffer.from(input.buffer,input.byteOffset,input.byteLength)
    if(typeof input !== 'string')return encode(input,false,true)
    if(isHeadered(input)){
        let {what,content} = parseHeaderedStr(input)
        let b = Buffer.from(content,'base64')
        b.what = what
        return b
    }else return Buffer.from(input,encoding)
    
    function parseHeaderedStr(headeredString){
        //returns what was in the label 'what' and the contents
        let r = /(?:-----BEGIN )(.+)(?:-----)/
        let what = headeredString.match(r)[1]
        let content = headeredString.split("\n")[1]
        return {what,content}
    }
    function isHeadered(){
        return /(?:-----BEGIN )(.+)(?:-----)/.test(input)
    }
}

export function uintToBuff(num,fixedLen){
    let n = Math.abs(num)
    let byteLength = Math.ceil(Math.log(n+1)/Math.log(256)) || 1
    if(fixedLen && fixedLen<byteLength)console.warn('value exceeds buffersize. Buffer represents end bytes.')
    fixedLen = fixedLen || byteLength
    let buff = Buffer.alloc(fixedLen)
    for ( let index = buff.length-1; index >= fixedLen-byteLength; index -- ) {
        let byte = n & 0xff;
        buff [ index ] = byte;
        n = (n - byte) / 256 ;
    }
    return buff;
}
export function buffToUint(bytes){
    let value = 0;
    for ( var index = 0; index < bytes.length; index ++ ) {
        value = (value * 256) + bytes[index];
    }
    return value;
}
export function intToBuff(num,fixedLen,signed){
    let n = (num<0)?num*-1:num
    let byteLength = Math.ceil(Math.log((signed?2:1*n)+1)/Math.log(256)) || 1
    if(byteLength > 6){throw new Error('Integer must be 48bit or less')}
    let buff = Buffer.allocUnsafe(fixedLen || byteLength)
    let op = (signed)?'writeIntBE':'writeUIntBE'
    if(fixedLen && fixedLen<byteLength)console.warn('value exceeds buffersize. Buffer represents end bytes.')
    buff[op](num,fixedLen?fixedLen-byteLength:0,byteLength)
    return buff
}
export function incBuffer (buffer,amt) {//increment buffer
    amt = uintToBuff(amt || 1)
    let amtEnd = amt.length - 1
    for (var i = amtEnd; i >= 0; i--) {
        let j =  buffer.length - 1 - amtEnd+i
        buffer = addBits(buffer,j,amt[i])
    }
    return buffer
    function addBits(b,j,m){
        if(j<0){return Buffer.from([m,...b])}
        let ovf = (b[j]+m)>255
        b[j]+= m
        if(ovf){
            return addBits(b,j-1,1)//increment next thing by 1
        }else{
            return b
        }
    }
}
export function buffToInt(buff,signed){
    let op = (signed)?'readIntBE':'readUIntBE'
    if(typeof buff === 'string')buff=Buffer.from(buff,'base64')
    return buff[op](0,buff.length);
}

export function outputHeaderedStr(jsTarget,what){
    const exportedAsBase64 = encode(jsTarget,true,true)//always encode, even if it is already buffer
    return `-----BEGIN ${what}-----\n${exportedAsBase64}\n-----END ${what}-----`;
}
export function parseHeaderedStr(headeredString){
    //returns what was in the label 'what' and the contents
    let r = /(?:-----BEGIN )(.+)(?:-----)/
    let what = headeredString.match(r)[1]
    let content = headeredString.split("\n")[1]
    return {what,content}
}


export function rand(len, charSet,all){
    var s = '';
    len = len || 24;
    charSet = charSet || '0123456789ABCDEFGHIJKLMNOPQRSTUVWXZabcdefghijklmnopqrstuvwxyz'
    while(len > 0){ s += charSet.charAt(Math.floor(Math.random() * charSet.length)); len-- }
    return s;
}
export function randInt(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min);
}
export function hash64(string){
    let h1 = hash(string)
    return h1 + hash(h1 + string)
}
export function hash(key, seed) {
	var remainder, bytes, h1, h1b, c1, c2, k1, i;
	
	remainder = key.length & 3; // key.length % 4
	bytes = key.length - remainder;
	h1 = seed;
	c1 = 0xcc9e2d51;
	c2 = 0x1b873593;
	i = 0;
	
	while (i < bytes) {
	  	k1 = 
	  	  ((key.charCodeAt(i) & 0xff)) |
	  	  ((key.charCodeAt(++i) & 0xff) << 8) |
	  	  ((key.charCodeAt(++i) & 0xff) << 16) |
	  	  ((key.charCodeAt(++i) & 0xff) << 24);
		++i;
		
		k1 = ((((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16))) & 0xffffffff;
		k1 = (k1 << 15) | (k1 >>> 17);
		k1 = ((((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16))) & 0xffffffff;

		h1 ^= k1;
        h1 = (h1 << 13) | (h1 >>> 19);
		h1b = ((((h1 & 0xffff) * 5) + ((((h1 >>> 16) * 5) & 0xffff) << 16))) & 0xffffffff;
		h1 = (((h1b & 0xffff) + 0x6b64) + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16));
	}
	
	k1 = 0;
	
	switch (remainder) {
		case 3: k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
		case 2: k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
		case 1: k1 ^= (key.charCodeAt(i) & 0xff);
		
		k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
		k1 = (k1 << 15) | (k1 >>> 17);
		k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
		h1 ^= k1;
	}
	
	h1 ^= key.length;

	h1 ^= h1 >>> 16;
	h1 = (((h1 & 0xffff) * 0x85ebca6b) + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
	h1 ^= h1 >>> 13;
	h1 = ((((h1 & 0xffff) * 0xc2b2ae35) + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16))) & 0xffffffff;
	h1 ^= h1 >>> 16;

	return h1 >>> 0;
}
export function quickHash(s){
    if(typeof s !== 'string'){ s = String(s) }
    let c = 0;
    if(!s.length){ return c }
    for(let i=0,l=s.length,n; i<l; ++i){
      n = s.charCodeAt(i);
      c = ((c<<5)-c)+n;
      c |= 0;
    }
    return c; // Math.abs(c);
}

export function getBaseLog(x, y) {
    return Math.log(y) / Math.log(x);
}



//SET STUFF
export function intersect(setA, setB) {
    var _intersection = new Set();
    for (var elem of setB) {
        if (setA.has(elem)) {
            _intersection.add(elem);
        }
    }
    return _intersection
}
export function union(setA, setB) {
    var _union = new Set(setA);
    for (var elem of setB) {
        _union.add(elem);
    }
    return _union;
}
export function removeFromArr(arr,index){//mutates array to remove value, 7x faster than splice
    var stop = arr.length - 1;
    while (index < stop) {
        arr[index] = arr[++index];
    }

    arr.pop();
}

//SORT STUFF
export function naturalCompare(a, b) {
    let ax = [], bx = [];
    a = String(a).trim().toUpperCase()  //trim and uppercase good idea?
    b = String(b).trim().toUpperCase()
    a.replace(/(\d+)|(\D+)/g, function(_, $1, $2) { ax.push([$1 || Infinity, $2 || ""]) });
    b.replace(/(\d+)|(\D+)/g, function(_, $1, $2) { bx.push([$1 || Infinity, $2 || ""]) });
    
    while(ax.length && bx.length) {
        let an = ax.shift();
        let bn = bx.shift();
        let nn = (an[0] - bn[0]) || an[1].localeCompare(bn[1]);
        if(nn) return nn;
    }

    return ax.length - bx.length;
}
import { ShapeGen } from "./ShapeGen"
import { SHAPEID, SHAPECHAIN, IMPURE, PID, IDS } from "./constants"
import { TypeDef } from "./typedef"

export const Stmts = new Map()
export function StmtGen(ID,desc){
    //desc is the payload from a describe stmt
    if(!ID.STMTID)throw new Error('Must specifiy STMTID that authored this statement type.')
    if(!desc[SHAPEID] === IDS.describeShape)throw new Error('Must specifiy a "describe" shape to build Stmt')
    let temp
    if((temp = Stmts.get(ID)))return temp
    const {relaxMetaShape,metaShape,relaxPayloadShape,payloadShape,
        retractable,directAssertion,hashTags,mentions,contexts,intent,minWork
    } = desc
    let dmid = MBuffer('MID',ID.slice(0,18))
    let dts = ID.slice(18)
    if(dmid === PID)dmid = null//really only for the protocol statements
    let sMetaTypes = {}
    let stmtReqs = 'sig & mid & ts & pub & dmid & dts & prev & rootHash'
    let defVals = [
        ['dmid', dmid],
        ['dts', dts],
        ['prev',Buffer.alloc(6)]
    ]
    for (const [tag,args,len] of [['hashTags',hashTags,18],['mentions',mentions,18],['contexts',contexts,24]]) {
        if(args[0] === -1 && args[1] === 0){
            sMetaTypes[tag] = T('null')
            defVals.push([tag,null])
        }else{
            sMetaTypes[tag] = T('array',[[T('binary',[len,len])],...args])
            if(args[0] > 0)stmtReqs += ' & '+ tag
        }
    }
    if(metaShape){
        stmtReqs += ' & metaShape & meta'
    }else{
        defVals.push(['metaShape',false])
        defVals.push(['meta',false])
    }
    if(payloadShape){
        stmtReqs += ' & payloadShape & payload'
    }else{
        defVals.push(['payloadShape',false])
        defVals.push(['payload',false])
    }
    //Things in merkle tree must ALWAYS be non-null
    const mtreeTD = T('array',[[T('array',[[T('binary',[18,18])]])]])
    const stmtshape = {
        keys:[
            //begin core stmt
            ['proof',T('binary')],
            ['sig',T('binary')],
            ['mid',T('binary',[18,18])],
            ['ts',T('binary',[6,6])],
            ['pub',T('binary',[2,2])],
            ['dmid',(dmid === null) ? T('null') : T('binary',[18,18])],
            ['dts',T('binary',[6,6])],
            ['prev',T('binary',[6,6])],
            ['rootHash',T('binary',[18,18])],
            // VVV these are merkle-ized in payloadTree
            ['metaShape',(metaShape === null) ? T('boolean') : T('shape',TYPESHAPE)],
            ['meta',T('ANY')],
            ['payloadShape',(payloadShape === null) ? T('boolean') : T('shape',TYPESHAPE)],
            ['payload',T('ANY')],
            // VVV these each have their own merkletree
            ['hashTags', sMetaTypes.hashTags],
            ['mentions', sMetaTypes.mentions],
            ['contexts', sMetaTypes.contexts],
            //end core stmt

            // other data for client/requestable data in regards to this stmt
            ['prevSig',T('binary')],
            ['pubKey',T('binary')],
            ['verified',T('boolean')],
            ['acks',T('array',[[T('binary',[18,18])]])],
            ['prevStmt',T('binary',[6,6])],
            ['payloadTree',mtreeTD],
            ['hashTagTree',mtreeTD],
            ['mentionsTree',mtreeTD],
            ['contextTree',mtreeTD],
            ['rootTree',mtreeTD],//5 merkletrees to produce rootHash (4 sub, 1 root tree)
            
        ],
        keyReqs: stmtReqs,
        defVals
    }
    stmtshape[SHAPEID] = IDS.shapeShape
    const Stmt = ShapeGen(ID,stmtshape,{
        classEmitter:true,
        instanceEmitter:true,
        setterChecks:{
            payload:function(val){
                if(payloadShape && payloadShape.shape){
                    if(!val[SHAPEID])throw new Error('Must pass a "Shape" for this payload')
                    if(!relaxPayloadShape && payloadShape.shape !== val[SHAPEID]){
                        throw new Error('Must provide exactly the Shape specified in the describe message.')
                    }else if(relaxPayloadShape === 'pure'){
                        if(!(val[SHAPECHAIN].includes(payloadShape.shape) && !val[IMPURE])){
                            throw new Error('Must provide a Shape that is part of the extended root, that is still pure.')
                        }
                    }
                }else if(payloadShape){
                    TypeDef.test(payloadShape,val)
                }
            },
            meta:function(val){
                if(metaShape && metaShape.shape){
                    if(!val[SHAPEID])throw new Error('Must pass a "Shape" for the meta property')
                    if(!relaxMetaShape && metaShape.shape !== val[SHAPEID]){
                        throw new Error('Must provide exactly the Shape specified in the describe message.')
                    }else if(relaxMetaShape === 'pure'){
                        if(!(val[SHAPECHAIN].includes(metaShape.shape) && !val[IMPURE])){
                            throw new Error('Must provide a Shape that is part of the extended root, that is still pure.')
                        }
                    }
                }else if(metaShape){
                    TypeDef.test(metaShape,val)
                }
            }
        }
    })
    Stmt.intent = intent
    //stored based on the Describe STMTID (This is what people will put as their dmid,dts values when creating a stmt)
    Stmts.set(ID,Stmt)
    
    
    Stmt.prototype.retractable = retractable //for client logic to deal with
    Stmt.prototype.directAssertion = directAssertion
    Stmt.prototype.minProof = minWork

    //we are giving all the stmts the same ID on their objects so everything will 'think' they are a regular stmt
    Stmt.prototype[SHAPEID] = IDS.stmtShape

    //EMIT: this is where we should emit an event to the higher logic client, could have been created from an async call

    return Stmt
}
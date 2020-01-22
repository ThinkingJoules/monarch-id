import { ShapeGen } from "./ShapeGen"
import { IDS, SHAPEID } from "./constants"
import { TypeDef } from "./typedef"


function T(type,param){
    return new TypeDef(type,param)
}


const personshape = {
    keys:[
        ['stmts',T('array',[[T('shape',IDS.stmtShape)]])],//only in memory
        ['stmtList',T('array',[[T('binary',[6,6])]])],//this goes on disk/sent as requested
        ['rank',T('enum',['MINO','landless','tributary','absolute','constitutional'])]
        ['domains',T('array',[[T('string')]])],
        ['tenancy',T('array',[[T('binary',[18,18])]])],
        ['easements',T('array',[[T('binary',[18,18])]])],
        ['forwarding',T('array',[[T('binary',[18,18])]])],
        ['owns',T('array',[[T('binary',[18,18])]])],
        ['ownedBy',T('binary',[18,18])],
        ['signets',T('array',[[T('tuple',[T('binary',[2,2]),T('binary')])]])],
        ['shields',T('array',[[T('tuple',[T('binary',[2,2]),T('binary')])]])],
        ['distance',T('number')],
        ['tail',T('binary')],
        ['work',T('number',[0,128])],
        ['nonAssertMentions',T('array',[[T('binary',[24,24])]])],
        ['unAckdAssertMentions',T('array',[[T('binary',[24,24])]])],
        ['ackdAssertMentions',T('array',[[T('binary',[24,24])]])],
    ],
    intent:'Used to track the state of an identity.'
}
personshape[SHAPEID] = IDS.shapeShape
export const PersonShape = ShapeGen(IDS.personShape,personshape,{classEmitter:true,instanceEmitter:true})

//add basic setter methods to help make the statemachine
//will need to do statemachine stuff at networking level?
//or will need to have proper listeners setup.

//add stmt
//addToArray(key,val,{push,shift},sortCB) //since all arrays are immutable
//packForDisk
PersonShape.prototype
import { ShapeGen } from "../ShapeGen"
import { IDS, SHAPEID } from "../constants"
import { TypeDef } from "../typedef"

function T(type,param){
    return new TypeDef(type,param)
}

const TYPESHAPE = IDS.typeShape
const SHAPESHAPE = IDS.shapeShape
const typeshape = {
    keys:[
        ['null',T('null')],
        ['boolean',T('null')],
        ['number',T('tuple'),[T('number'),T('number')]],
        ['string',T('tuple'),[T('number'),T('number')]],
        ['binary',T('tuple'),[T('number'),T('number')]],
        ['shape',T('binary',[24,24])],
        ['enum',T('array',[[T('string')]])],
        ['array',T('tuple',[T('array',[[T('shape',TYPESHAPE)]]),T('number'),T('number')])],
        ['tuple',T('array',[[T('shape',TYPESHAPE)]])],
    ],
    keyReqs:'null ^ boolean ^ number ^ string ^ binary ^ shape ^ enum ^ array ^ tuple',//tag union
    strictReq: true
}
typeshape[SHAPEID] = SHAPESHAPE
export const Type = ShapeGen(TYPESHAPE,typeshape)//

const shapeshape = {
    keys:[
        ['extends',T('binary',24)],
        ['keys',T('array',[T('tuple',[T('string'),T('shape',TYPESHAPE)])])],
        ['keyReqs',T('string')],
        ['strictReq',T('boolean')],
        ['defVal',T('array',[T('tuple',[T('string'),T('shape',TYPESHAPE)])])],
        ['intent',T('string',[0,280])]
    ],
    keyReqs: 'keys & intent',
    intent:'This is so meta... My head hurts.'
}
shapeshape[SHAPEID] = SHAPESHAPE
export const Shape = ShapeGen(SHAPESHAPE,shapeshape,{classEmitter:true})

const describeshape = {
    keys:[
        //shape info
        ['relaxMetaShape',T('enum',['pure','any'])]//only matters if metaShape is a Type.shape
        ['metaShape',T([T('null'),T('shape',TYPESHAPE)])]//always exact unless it is a Type.shape and 'relax' is present
        ['relaxPayloadShape',T('enum',['pure','any'])]//only matters if payloadShape is a Type.shape
        ['payloadShape',T([T('null'),T('shape',TYPESHAPE)])]
    
        //stmt info
        ['retractable',T('boolean')],//should the network recognize a retraction to a msg of this type
        ['directAssertion',T('boolean')],//requires Ack to be 'true'
        ['hashTags',T('tuple'),[T('number'),T('number')]],//min max
        ['mentions',T('tuple'),[T('number'),T('number')]],//min max
        ['contexts',T('tuple'),[T('number'),T('number')]],//min max
    
        ['intent',T('string',[0,500])]//500 char description
    
        ['minWork',T('number',[0,128])]

    
    ],
    keyReqs: 'metaShape & payloadShape & retractable',
    defVals:[
        ['directAssertion',false],//requires Ack to be 'true'
        ['minWork',13]
        ['hashTags',[0,5]],//min max
        ['mentions',[0,10]],//min max
        ['contexts',[0,100]],//min max
    ]
}
describeshape[SHAPEID] = SHAPESHAPE
export const Describe = ShapeGen(IDS.describeShape,describeshape,{classEmitter:true})

const keyshape = {
    keys:[
        ['type',T('string',[0,140])],
        ['pub',T('binary')],
        ['auth',T('binary')]
    ],
    keyReqs: 'type & pub',
    intent:'Used to describe a new ECC key. "auth" is for optional encrypted private key storage for remote retrieval.'
}
keyshape[SHAPEID] = IDS.shapeShape
export const KeyShape = ShapeGen(IDS.shieldSignetShape,keyshape)
import { ShapeGen } from "../ShapeGen"
import { IDS, SHAPEID } from "../constants"
import { TypeDef } from "../typedef"

function T(type,param){
    return new TypeDef(type,param)
}

//networking shapes...
const personshape = {
    keys:[
        
    ],
    keyReqs: 'type & pub',
    intent:'Used to describe a new ECC key. "auth" is for optional encrypted private key storage for remote retrieval.'
}
personshape[SHAPEID] = IDS.shapeShape
export const PersonShape = ShapeGen(IDS.personShape,personshape,{classEmitter:true,instanceEmitter:true})
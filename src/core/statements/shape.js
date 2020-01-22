import { StmtGen } from "../StmtGen";
import { IDS } from "../../constants";
import { Type, Describe } from "../shapes/coreShapes";

let t = new Type()
t.shape = IDS.shapeStmt
const describeShape = new Describe()
describeShape[Symbol.for('Shape.setKeys')]({
    metaShape: null,
    relaxPayloadShape:'pure',    
    payloadShape: t,
    retractable:false,
    directAssertion:false,
    mentions:[-1,0],//cannot mention anyone
    contexts:[-1,0],//cannot point it at another stmt
    intent: 'Use to generate new Shapes (objects) that the '+
    'entire network will be able to parse using this statement.',
    minWork:18
})
export const ShapeStmt = StmtGen(ids.shape,describeShape)
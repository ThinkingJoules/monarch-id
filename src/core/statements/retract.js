import { StmtGen } from "../StmtGen"
import { Type, Describe } from "../shapes/coreShapes"
import { IDS } from "../../constants"

let t0 = new Type()
t0.binary = [6,6]


const describeRetract = new Describe()
describeRetract[Symbol.for('Shape.setKeys')]({
    metaShape: null,
    payloadShape: t0,
    retractable:false,
    directAssertion:false,
    hashTags:[-1,0],//cannot index
    mentions:[-1,0],//cannot mention anyone
    contexts:[-1,0],//cannot point it at another stmt
    intent: 'Used to retract/invalidate a previous statement. Payload should be the timestamp ("ts") for which statement on your chain.'
})
export const RetractStmt = StmtGen(IDS.retractStmt,describeRetract)
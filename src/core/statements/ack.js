import { StmtGen } from "../StmtGen"
import { Type, Describe } from "../shapes/coreShapes"
import { IDS } from "../../constants"

let t1 = new Type()
t1.boolean = null

const describeAck = new Describe()
describeAck[Symbol.for('Shape.setKeys')]({
    metaShape: null,
    payloadShape: t1,
    relaxPayloadShape:'pure',
    retractable:true,
    directAssertion:false,
    hashTags:[-1,0],//cannot index
    mentions:[-1,0],//cannot mention anyone
    contexts:[1,100],//can point it at many other stmts
    intent: 'Ack or Nack a stmt. Payload is boolean. '+
    'General statement of approval/disapproval, agreement/disagreement, +1/-1. '+
    '*Meaning depends on the statement type(s) you are acking.'
})
export const AckStmt = StmtGen(IDS.ackStmt,describeAck)
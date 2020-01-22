import { StmtGen } from "../StmtGen"
import { Describe } from "../shapes/coreShapes"
import { IDS } from "../constants"


const describeRegnalName = new Describe()
describeRegnalName[Symbol.for('Shape.setKeys')]({
    metaShape: null,
    payloadShape: null,
    retractable:true,
    directAssertion:false,
    hashTags:[1,1],//only one name per stmt (so we can rank the name by work)
    mentions:[-1,0],//cannot mention anyone
    contexts:[-1,0],//cannot point it at many other stmts
    intent: 'Specify a single hashTag that represents a more-human-friendly/memorable value than your identity ID. '+
    'Once they find this statement, the ID will be included so they can perform more queries using that. '+
    'It is only intended to help find an ID with something human-friendly. There is no uniqueness guarantees, '+
    'but should be returned in order of most work to least work in the event of a collision.',
    minWork: 14
})
export const RegnalNameStmt = StmtGen(IDS.rnStmt,describeRegnalName)
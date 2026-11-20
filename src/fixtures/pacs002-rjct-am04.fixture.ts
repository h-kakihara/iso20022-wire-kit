export const PACS002_RJCT_AM04_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.002.001.10">
  <FIToFIPmtStsRpt>
    <GrpHdr>
      <MsgId>PACS002-RJCT-20261120-01</MsgId>
      <CreDtTm>2026-11-20T09:15:04Z</CreDtTm>
      <InstgAgt>
        <FinInstnId>
          <BICFI>BNPAFRPPXXX</BICFI>
        </FinInstnId>
      </InstgAgt>
      <InstdAgt>
        <FinInstnId>
          <BICFI>DEUTDEFFXXX</BICFI>
        </FinInstnId>
      </InstdAgt>
    </GrpHdr>
    <OrgnlGrpInfAndSts>
      <OrgnlMsgId>PACS008-TGT-20261120-01</OrgnlMsgId>
      <OrgnlMsgNmId>pacs.008.001.08</OrgnlMsgNmId>
      <OrgnlCreDtTm>2026-11-20T09:15:00Z</OrgnlCreDtTm>
      <GrpSts>RJCT</GrpSts>
      <StsRsnInf>
        <Rsn>
          <Cd>AM04</Cd>
        </Rsn>
        <AddtlInf>Insufficient RTGS intraday settlement liquidity</AddtlInf>
      </StsRsnInf>
    </OrgnlGrpInfAndSts>
    <TxInfAndSts>
      <StsId>STS-RJCT-0001</StsId>
      <OrgnlInstrId>TGT-INSTR-0001</OrgnlInstrId>
      <OrgnlEndToEndId>E2E-TGT-0001</OrgnlEndToEndId>
      <OrgnlTxId>TX-TGT-90001</OrgnlTxId>
      <OrgnlUETR>eb6305c9-1f7f-49de-aed0-16487c27b42d</OrgnlUETR>
      <TxSts>RJCT</TxSts>
      <StsRsnInf>
        <Rsn>
          <Cd>AM04</Cd>
        </Rsn>
        <AddtlInf>Debtor reserve account below required threshold</AddtlInf>
      </StsRsnInf>
    </TxInfAndSts>
  </FIToFIPmtStsRpt>
</Document>
`;

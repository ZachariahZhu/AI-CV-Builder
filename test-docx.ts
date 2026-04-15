import { Document, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, Packer, AlignmentType } from "docx";

const b = BorderStyle.NONE;

const doc = new Document({
    sections: [{
        children: [
            new Paragraph({
                text: "Hello",
                alignment: AlignmentType.CENTER
            })
        ]
    }]
});

Packer.toBuffer(doc).then(r => console.log("Success", r.length));

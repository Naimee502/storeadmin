import { GraphQLUpload } from 'graphql-upload';
import { finished } from 'stream/promises';
import path from 'path';
import fs from 'fs';

export const uploadResolvers = {
  Upload: GraphQLUpload,

  Mutation: {
    uploadImage: async (_parent: any, { file }: { file: any }) => {
      console.log("📥 UploadImage resolver hit!");
      const { createReadStream, filename, mimetype, encoding } = await file;

      // Correct path from resolver file to uploads folder
      const uploadDir = path.join(__dirname, '../../../uploads');

      // Make sure upload dir exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Create unique filename to avoid overwrites
      const uniqueFilename = `${Date.now()}-${filename}`;
      console.log('Saving file:', uniqueFilename);
      const filepath = path.join(uploadDir, uniqueFilename);

      // Save file to disk
      const stream = createReadStream();
      const out = fs.createWriteStream(filepath);
      stream.pipe(out);
      await finished(out); // wait for the file to be fully written

      // Return file info with URL pointing to static served folder
      return {
        filename: uniqueFilename,
        mimetype,
        encoding,
        url: `http://localhost:4000/uploads/${uniqueFilename}`,
      };
    },
  },
};

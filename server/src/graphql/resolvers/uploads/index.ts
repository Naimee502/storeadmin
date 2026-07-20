import { GraphQLUpload } from 'graphql-upload';
import { finished } from 'stream/promises';
import path from 'path';
import fs from 'fs';

export const uploadResolvers = {
  Upload: GraphQLUpload,

  Mutation: {
    uploadImage: async (_parent: any, { file }: { file: any }, context: any) => {
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

      // Build a URL any caller can actually reach. A hardcoded
      // "http://localhost:4000" only resolves on the machine running the
      // server itself — the admin panel's own browser (localhost) happened
      // to work by coincidence, but the mobile app (LAN IP / ngrok /
      // production domain) could never load it. Prefer an explicit
      // PUBLIC_BASE_URL (set this in production), otherwise derive it from
      // the incoming request so LAN/ngrok/prod all resolve correctly.
      const req = context?.req;
      const base = process.env.PUBLIC_BASE_URL
        || (req ? `${req.protocol}://${req.get('host')}` : `http://localhost:${process.env.PORT || 4000}`);

      return {
        filename: uniqueFilename,
        mimetype,
        encoding,
        url: `${base}/uploads/${uniqueFilename}`,
      };
    },
  },
};

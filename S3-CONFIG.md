# Bus Images Configuration Guide

## S3 Configuration

The application is set up to store bus images in an S3 bucket. Here's how it works:

1. **S3 Bucket**: 
   - The bucket name is configured in `backend/.env` as `S3_BUCKET_NAME` (currently set to `businfouserprofilepic`)
   - AWS credentials are also stored in this file

2. **Image Upload Process**:
   - When adding a bus, images are uploaded to S3 via presigned URLs
   - The backend handles generating these URLs via the `/uploads/avatar-url` endpoint
   - Only the image URLs are stored in DynamoDB, not the actual image data

## Troubleshooting

If bus images are not showing:

1. **Check S3 Bucket Access**:
   - Ensure the S3 bucket exists and is accessible with your credentials
   - Verify CORS configuration allows access from your frontend domain

2. **Check AWS Credentials**:
   - Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in both `frontend/.env` and `backend/.env`
   - These credentials must have permissions to write to the S3 bucket

3. **Check Environment Variables**:
   - Ensure `S3_BUCKET_NAME` is set correctly in `backend/.env`
   - Verify `VITE_API_BASE` in `frontend/.env` points to the correct backend

4. **Enable Debug Logging**:
   - Add `console.log` statements in the image upload process to track issues
   - Check browser console and server logs for errors

If you're seeing 403 errors, check bucket permissions and CORS configuration:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::businfouserprofilepic/*"
        }
    ]
}
```

And CORS configuration:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "PUT",
            "POST",
            "GET"
        ],
        "AllowedOrigins": [
            "http://localhost:5173",
            "https://your-production-domain.com"
        ],
        "ExposeHeaders": []
    }
]
```
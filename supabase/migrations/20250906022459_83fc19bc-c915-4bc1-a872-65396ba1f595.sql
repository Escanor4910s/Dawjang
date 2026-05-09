-- Create RLS policies for course-documents storage bucket
-- Allow users to upload their own files
CREATE POLICY "Users can upload their own course documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'course-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own files
CREATE POLICY "Users can view their own course documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'course-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own files
CREATE POLICY "Users can update their own course documents" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'course-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own course documents" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'course-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
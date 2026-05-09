-- Create storage bucket for course documents
INSERT INTO storage.buckets (id, name, public) VALUES ('course-documents', 'course-documents', false);

-- Create policies for course documents storage
CREATE POLICY "Users can upload their own course documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'course-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own course documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'course-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own course documents" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'course-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
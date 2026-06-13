-- Tạo storage bucket cho icon phái (hình ảnh độc quyền, không lưu git)
INSERT INTO storage.buckets (id, name, public)
VALUES ('phai-icons', 'phai-icons', true)
ON CONFLICT (id) DO NOTHING;

-- Cho phép public đọc (bot cần đọc để hiển thị)
CREATE POLICY "Public read phai-icons"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'phai-icons');

-- Admin có thể upload/delete
CREATE POLICY "Admin upload phai-icons"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'phai-icons'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Admin delete phai-icons"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'phai-icons'
    AND auth.role() = 'authenticated'
  );

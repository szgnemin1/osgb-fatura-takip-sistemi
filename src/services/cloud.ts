

// Google Firebase REST API Servisi
// SDK gerektirmez, sadece HTTP istekleri ile çalışır.

export const cloudService = {
  // Veriyi Buluta Gönder (Upload)
  uploadData: async (dbUrl: string, data: any) => {
    try {
      // URL sonundaki slash'i temizle ve .json ekle
      const cleanUrl = dbUrl.replace(/\/$/, "");
      const endpoint = `${cleanUrl}/osgb_data.json`;

      const response = await fetch(endpoint, {
        method: 'PUT', // PUT mevcudun üzerine yazar
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error("Cloud Upload Error:", error);
      throw error;
    }
  },

  // Veriyi Buluttan İndir (Download)
  downloadData: async (dbUrl: string) => {
    try {
      const cleanUrl = dbUrl.replace(/\/$/, "");
      const endpoint = `${cleanUrl}/osgb_data.json`;

      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Cloud Download Error:", error);
      throw error;
    }
  }
};
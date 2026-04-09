import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

async function run() {
  try {
    const form = new FormData();
    form.append('company_id', 'test-company-id');
    form.append('category', 'Políticas');
    
    // Anexar um arquivo pequeno
    const fileBuffer = Buffer.from('test doc content api');
    form.append('files', fileBuffer, {
      filename: 'api_test.txt',
      contentType: 'text/plain'
    });

    console.log("Sending request to http://localhost:3001/api/admin/docs/upload...");
    const res = await axios.post('http://localhost:3001/api/admin/docs/upload', form, {
      headers: form.getHeaders(),
    });

    console.log("Response:", res.data);
  } catch (err) {
    if (err.response) {
      console.error("Error Response:", err.response.data);
    } else {
      console.error("Error:", err.message);
    }
  }
}

run();

import React, { useState, useEffect, useRef } from "react";
import "./App.css";

const SERVER_URL = process.env.REACT_APP_SERVER_URL;

function App() {
  const [stories, setStories] = useState([]);
  const [images, setImages] = useState([null, null, null, null]);
  const [previews, setPreviews] = useState([null, null, null, null]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedStory, setSelectedStory] = useState(null);
  const fileInputRefs = [useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/stories`);
      if (!response.ok) throw new Error("서버 오류");
      const data = await response.json();
      if (Array.isArray(data)) setStories(data);
    } catch (error) {
      console.error("스토리 조회 중 오류:", error);
    }
  };

  // 이미지 리사이징 (최대 800px, 용량 절약)
  const resizeImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 800;
          let { width, height } = img;

          if (width > height && width > MAX_SIZE) {
            height = (height * MAX_SIZE) / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width = (width * MAX_SIZE) / height;
            height = MAX_SIZE;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageSelect = async (index, e) => {
    const file = e.target.files[0];
    if (!file) return;

    const resized = await resizeImage(file);
    const newImages = [...images];
    const newPreviews = [...previews];
    newImages[index] = resized;
    newPreviews[index] = resized;
    setImages(newImages);
    setPreviews(newPreviews);
  };

  const removeImage = (index) => {
    const newImages = [...images];
    const newPreviews = [...previews];
    newImages[index] = null;
    newPreviews[index] = null;
    setImages(newImages);
    setPreviews(newPreviews);
    if (fileInputRefs[index].current) fileInputRefs[index].current.value = "";
  };

  // 드래그앤드롭 처리
  const [dragOver, setDragOver] = useState(null);

  const handleDrop = async (index, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    if (isGenerating) return;

    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith("image/")) return;

    const resized = await resizeImage(file);
    const newImages = [...images];
    const newPreviews = [...previews];
    newImages[index] = resized;
    newPreviews[index] = resized;
    setImages(newImages);
    setPreviews(newPreviews);
  };

  const handleDragOver = (index, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(index);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
  };

  const allImagesSelected = images.every((img) => img !== null);

  const generateStory = async () => {
    if (!allImagesSelected || isGenerating) return;

    setIsGenerating(true);
    try {
      const response = await fetch(`${SERVER_URL}/stories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });

      if (!response.ok) throw new Error("스토리 생성 실패");

      const newStory = await response.json();
      setSelectedStory(newStory);
      await fetchStories();

      // 이미지 초기화
      setImages([null, null, null, null]);
      setPreviews([null, null, null, null]);
      fileInputRefs.forEach((ref) => {
        if (ref.current) ref.current.value = "";
      });
    } catch (error) {
      console.error("스토리 생성 중 오류:", error);
      alert("스토리 생성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteStory = async (id) => {
    try {
      await fetch(`${SERVER_URL}/stories/${id}`, { method: "DELETE" });
      if (selectedStory?.id === id) setSelectedStory(null);
      await fetchStories();
    } catch (error) {
      console.error("스토리 삭제 중 오류:", error);
    }
  };

  const deleteAllStories = async () => {
    if (!window.confirm("모든 스토리를 삭제하시겠습니까?")) return;
    try {
      await fetch(`${SERVER_URL}/stories`, { method: "DELETE" });
      setSelectedStory(null);
      await fetchStories();
    } catch (error) {
      console.error("전체 삭제 중 오류:", error);
    }
  };

  const sceneLabels = ["기 (시작)", "승 (전개)", "전 (절정)", "결 (결말)"];

  return (
    <div className="App">
      {/* 헤더 */}
      <header>
        <h1 className="title">Contes des quatre saisons</h1>
        <p className="subtitle">4장의 사진이 하나의 이야기가 됩니다</p>
      </header>

      <main className="main-content">
        {/* 이미지 업로드 섹션 */}
        <section className="upload-section">
          <h2 className="section-title">장면을 선택하세요</h2>
          <p className="section-desc">
            4장의 사진을 순서대로 올려주세요. AI가 기승전결 구조의 스토리를 만들어드립니다.
          </p>

          <div className="image-grid">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="image-slot">
                <span className="scene-label">{sceneLabels[index]}</span>
                {previews[index] ? (
                  <div className="preview-container">
                    <img
                      src={previews[index]}
                      alt={`장면 ${index + 1}`}
                      className="preview-image"
                    />
                    <button
                      className="remove-btn"
                      onClick={() => removeImage(index)}
                      disabled={isGenerating}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label
                    className={`upload-label${dragOver === index ? " drag-active" : ""}`}
                    onDrop={(e) => handleDrop(index, e)}
                    onDragOver={(e) => handleDragOver(index, e)}
                    onDragLeave={handleDragLeave}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRefs[index]}
                      onChange={(e) => handleImageSelect(index, e)}
                      hidden
                      disabled={isGenerating}
                    />
                    <div className="upload-placeholder">
                      <span className="upload-icon">+</span>
                      <span>{dragOver === index ? "여기에 놓기" : `장면 ${index + 1}`}</span>
                    </div>
                  </label>
                )}
              </div>
            ))}
          </div>

          <button
            className="generate-btn"
            onClick={generateStory}
            disabled={!allImagesSelected || isGenerating}
          >
            {isGenerating ? (
              <span className="generating">
                <span className="spinner" /> AI가 스토리를 만들고 있습니다...
              </span>
            ) : (
              "✨ 스토리 생성하기"
            )}
          </button>
        </section>

        {/* 선택된 스토리 상세 보기 */}
        {selectedStory && selectedStory.story && (
          <section className="story-detail">
            <h2 className="story-detail-title">
              {selectedStory.title || "무제"}
            </h2>

            {/* 장면 이미지 */}
            <div className="story-images">
              {[selectedStory.image1, selectedStory.image2, selectedStory.image3, selectedStory.image4].map(
                (img, i) =>
                  img && (
                    <div key={i} className="story-image-item">
                      <span className="story-scene-label">{sceneLabels[i]}</span>
                      <img src={img} alt={`장면 ${i + 1}`} />
                    </div>
                  )
              )}
            </div>

            <div className="story-text">
              {selectedStory.story.split("\n").map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
            <button
              className="close-btn"
              onClick={() => setSelectedStory(null)}
            >
              닫기
            </button>
          </section>
        )}

        {/* 스토리 목록 */}
        <section className="stories-section">
          <div className="stories-header">
            <h2 className="section-title">나의 스토리</h2>
            {stories.length > 0 && (
              <button className="delete-all-btn" onClick={deleteAllStories}>
                전체 삭제
              </button>
            )}
          </div>

          {stories.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">✦</span>
              <p>아직 만들어진 스토리가 없습니다.</p>
              <p>사진 4장을 올려서 첫 번째 이야기를 만들어보세요!</p>
            </div>
          ) : (
            <div className="stories-grid">
              {stories.map((story) => (
                <div key={story.id} className="story-card">
                  {story.image1 && (
                    <div className="card-thumbnail">
                      <img src={story.image1} alt="썸네일" />
                    </div>
                  )}
                  <div className="card-content">
                    <h3 className="card-title">
                      {story.title || "생성 중..."}
                    </h3>
                    <p className="card-preview">
                      {story.story
                        ? story.story.replace(/【제목:.*?】\n?/, "").substring(0, 120) + "..."
                        : "스토리를 생성하고 있습니다..."}
                    </p>
                    <span className="card-date">
                      {new Date(story.created_at).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="card-actions">
                    {story.story && (
                      <button
                        className="read-btn"
                        onClick={() => setSelectedStory(story)}
                      >
                        읽기
                      </button>
                    )}
                    <button
                      className="card-delete-btn"
                      onClick={() => deleteStory(story.id)}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <p>Contes des quatre saisons</p>
      </footer>
    </div>
  );
}

export default App;

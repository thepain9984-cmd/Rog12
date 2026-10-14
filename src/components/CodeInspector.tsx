import React, { useState } from 'react';
import { ANDROID_PROJECT_FILES, ProjectFile } from '../data/sourceCode';
import {
  FileCode,
  Copy,
  Check,
  Download,
  FolderArchive,
  Search,
  ExternalLink,
  Code2,
  FileCheck2,
} from 'lucide-react';
import JSZip from 'jszip';

export const CodeInspector: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<ProjectFile>(ANDROID_PROJECT_FILES[0]);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isZipping, setIsZipping] = useState(false);

  const filteredFiles = ANDROID_PROJECT_FILES.filter((file) => {
    const matchesCat = selectedCategory === 'all' || file.category === selectedCategory;
    const matchesSearch =
      file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.path.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingle = () => {
    const blob = new Blob([selectedFile.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();

      // Add each project file at its relative path
      ANDROID_PROJECT_FILES.forEach((f) => {
        zip.file(f.path, f.code);
      });

      // Add gradlew shell script and wrapper
      zip.file('gradlew', '#!/bin/sh\nexec gradle "$@"\n');
      zip.file(
        'gradle/wrapper/gradle-wrapper.properties',
        'distributionBase=GRADLE_USER_HOME\ndistributionPath=wrapper/dists\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-8.2-bin.zip\nnetworkTimeout=10000\nvalidateDistributionUrl=true\nzipStoreBase=GRADLE_USER_HOME\nzipStorePath=wrapper/dists\n'
      );
      zip.file(
        'gradle.properties',
        'org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8\nandroid.useAndroidX=true\nandroid.enableJetifier=true\nandroid.nonTransitiveRClass=true\n'
      );
      zip.file(
        'app/src/main/res/values/strings.xml',
        '<resources>\n    <string name="app_name">ROG Virtual Console</string>\n    <string name="accessibility_service_desc">Enables low-latency virtual gamepad touch mapping and sensitivity-boosted gestures over mobile games.</string>\n</resources>\n'
      );

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rog_virtual_console_android_project.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create zip', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="w-full flex flex-col bg-[#0b0e17] border border-[#232a3e] rounded-xl overflow-hidden shadow-2xl">
      {/* Top Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#101422] border-b border-[#232b40]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-red-600/20 border border-red-500/40 text-[#ff003f]">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-orbitron font-bold text-base text-white tracking-wide">
              Android Source Code Inspector & Package Hub
            </h3>
            <p className="text-xs text-gray-400">
              CompileSDK 34 | Java 17 | AccessibilityService Touch Injection | WindowManager Overlay
            </p>
          </div>
        </div>

        {/* Global Zip Download */}
        <button
          onClick={handleDownloadAllZip}
          disabled={isZipping}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#ff003f] to-[#e60039] hover:from-[#ff1a53] hover:to-[#ff003f] text-white font-semibold text-xs tracking-wide shadow-lg shadow-red-900/30 transition-all cursor-pointer disabled:opacity-50"
        >
          <FolderArchive className="w-4 h-4" />
          <span>{isZipping ? 'PACKING ZIP...' : 'DOWNLOAD FULL ANDROID PROJECT (.ZIP)'}</span>
        </button>
      </div>

      {/* Main Two-Column View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
        {/* Left File Navigation List */}
        <div className="lg:col-span-4 bg-[#0e121d] border-b lg:border-b-0 lg:border-r border-[#22293d] p-3 flex flex-col">
          {/* Search Input */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search files or paths..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#151a28] border border-[#262f44] rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-[#ff003f]"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1 mb-3 overflow-x-auto pb-1 text-[11px]">
            {['all', 'java', 'manifest', 'gradle', 'ci-cd'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded capitalize font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[#ff003f] text-white font-bold'
                    : 'bg-[#151a28] text-gray-400 hover:text-white'
                }`}
              >
                {cat === 'all' ? 'All Files' : cat.toUpperCase()}
              </button>
            ))}
          </div>

          {/* File Items List */}
          <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[500px] pr-1">
            {filteredFiles.map((file) => {
              const isSelected = selectedFile.path === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-[#1a2030] border-[#ff003f] shadow-md shadow-red-950/20'
                      : 'bg-[#121623] border-[#1e2436] hover:bg-[#161c2c] hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono text-xs font-semibold ${
                        isSelected ? 'text-[#ff003f]' : 'text-gray-200'
                      }`}
                    >
                      {file.name}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${
                        file.category === 'java'
                          ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                          : file.category === 'ci-cd'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                          : file.category === 'manifest'
                          ? 'bg-cyan-950/60 text-cyan-400 border border-cyan-800/60'
                          : 'bg-purple-950/60 text-purple-400 border border-purple-800/60'
                      }`}
                    >
                      {file.category}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono truncate">{file.path}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Code Display Area */}
        <div className="lg:col-span-8 flex flex-col bg-[#090b12]">
          {/* File Info Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#111524] border-b border-[#20273c]">
            <div className="flex flex-col">
              <span className="font-mono text-xs font-bold text-white flex items-center gap-2">
                <FileCode className="w-4 h-4 text-[#00e5ff]" />
                {selectedFile.path}
              </span>
              <span className="text-[11px] text-gray-400 mt-0.5">{selectedFile.description}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#181f30] hover:bg-[#20283c] border border-[#2b354e] text-xs font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'COPIED!' : 'COPY CODE'}</span>
              </button>

              <button
                onClick={handleDownloadSingle}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#181f30] hover:bg-[#20283c] border border-[#2b354e] text-xs font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer"
                title="Download this file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>SAVE</span>
              </button>
            </div>
          </div>

          {/* Code Viewer with Line Numbers */}
          <div className="flex-1 overflow-auto max-h-[580px] p-4 font-mono text-xs leading-relaxed bg-[#07090e]">
            <pre className="text-gray-300 select-text whitespace-pre">
              <code>{selectedFile.code}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

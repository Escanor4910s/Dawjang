Get-ChildItem -Path "src\pages", "src\components" -Filter "*.tsx" -Recurse | ForEach-Object {
    $content = Get-Content -Raw $_.FullName
    $original = $content
    
    # 1. Add bg-doodle-watermark if missing on min-h-screen
    if ($content -match 'min-h-screen' -and $content -notmatch 'bg-doodle-watermark') {
        $content = $content -replace 'className="min-h-screen\s*', 'className="min-h-screen bg-doodle-watermark '
        $content = $content -replace 'className=\{"min-h-screen\s*', 'className={"min-h-screen bg-doodle-watermark '
        $content = $content -replace 'className=\{\s*min-h-screen\s*', 'className={min-h-screen bg-doodle-watermark '
    }

    # 2. Remove transparency
    $content = $content -replace 'bg-white/80\s+backdrop-blur-xl', 'bg-white'
    $content = $content -replace 'bg-white/90\s+backdrop-blur-xl', 'bg-white'
    $content = $content -replace 'bg-white/80', 'bg-white'
    $content = $content -replace 'bg-white/90', 'bg-white'
    $content = $content -replace 'bg-\[#FDFBF7\]/50\s+backdrop-blur-xl', 'bg-[#FDFBF7]'
    $content = $content -replace 'bg-\[#FDFBF7\]/80\s+backdrop-blur-xl', 'bg-[#FDFBF7]'
    $content = $content -replace 'bg-\[#FDFBF7\]/50', 'bg-[#FDFBF7]'
    $content = $content -replace 'bg-\[#FDFBF7\]/80', 'bg-[#FDFBF7]'
    $content = $content -replace 'bg-\[#F4F0E1\]/50\s+backdrop-blur-xl', 'bg-[#F4F0E1]'
    $content = $content -replace 'bg-\[#F4F0E1\]/50', 'bg-[#F4F0E1]'
    
    if ($original -ne $content) {
        Set-Content -Path $_.FullName -Value $content -Encoding UTF8
        Write-Output "Updated: $($_.Name)"
    }
}

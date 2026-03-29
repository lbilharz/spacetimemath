require 'xcodeproj'

project_path = 'App.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# 1. Add file reference to the main 'App' group if not exists
app_group = project.main_group.children.find { |c| c.display_name == 'App' || c.name == 'App' }
unless app_group
  puts "Failed to find 'App' group"
  exit 1
end

# Check if App/App.entitlements already exists
entitlements_ref = app_group.children.find { |c| c.path == 'App.entitlements' || c.name == 'App.entitlements' }
if entitlements_ref.nil?
  puts "Adding App.entitlements reference to project"
  entitlements_ref = app_group.new_file('App.entitlements')
end

# 2. Update build settings for ALL configurations in the App target
app_target = project.targets.find { |t| t.name == 'App' }
if app_target.nil?
  puts "Failed to find 'App' target"
  exit 1
end

app_target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'
end

# Save cleanly
project.save
puts "Successfully added CODE_SIGN_ENTITLEMENTS to #{project_path}"

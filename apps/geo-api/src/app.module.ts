import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { GEO_DB, GeoDbPg } from './common/geo-db.js';
import { REALTIME } from './realtime/realtime.js';
import { LocationsGateway } from './realtime/locations.gateway.js';
import { GroupsController } from './modules/groups/groups.controller.js';
import { GroupsService } from './modules/groups/groups.service.js';
import { SharingController } from './modules/sharing/sharing.controller.js';
import { SharingService } from './modules/sharing/sharing.service.js';
import { LocationsController } from './modules/locations/locations.controller.js';
import { LocationsService } from './modules/locations/locations.service.js';
import { GeofencingController } from './modules/geofencing/geofencing.controller.js';
import { GeofencingService } from './modules/geofencing/geofencing.service.js';
import { JobsService } from './jobs/jobs.service.js';
import { AdminController } from './jobs/admin.controller.js';
import { NotificationsService } from './notifications/notifications.service.js';
import { PUSH_SENDER, createPushSender } from './notifications/push-sender.js';
import { DevicesController, DevicesService } from './notifications/devices.controller.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [GroupsController, SharingController, LocationsController, GeofencingController, AdminController, DevicesController],
  providers: [
    { provide: GEO_DB, useClass: GeoDbPg },
    LocationsGateway,
    { provide: REALTIME, useExisting: LocationsGateway },
    { provide: PUSH_SENDER, useFactory: createPushSender },
    NotificationsService,
    DevicesService,
    GroupsService,
    SharingService,
    LocationsService,
    GeofencingService,
    JobsService,
  ],
})
export class AppModule {}
